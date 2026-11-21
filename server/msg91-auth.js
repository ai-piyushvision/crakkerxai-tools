/* Cloudflare Worker MSG91 -> Supabase bridge. Never trust client-supplied phone identity. */
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'
}});
const fail = (message,status=400) => json({error:message},status);
const DEFAULT_SUPABASE_URL='https://knhduwfwngrffnlxbnwt.supabase.co';
export function phoneAuthConfig(env) {
  // Use an explicitly configured widget ID. A baked-in default can silently pair
  // a browser token with a different MSG91 widget and produce AuthenticationFailure.
  const hasProjectOverride=Boolean(env.SUPABASE_URL||env.SUPABASE_ANON_KEY);
  const completeProjectOverride=!hasProjectOverride||Boolean(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY);
  const projectUrl=String(env.SUPABASE_URL||DEFAULT_SUPABASE_URL);
  const validProjectUrl=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl);
  const bridgeReady=Boolean(env.MSG91_AUTHKEY && env.SUPABASE_SERVICE_ROLE_KEY && completeProjectOverride && validProjectUrl);
  // The owner's existing SecureOTPWidgetCNWD is confirmed WhatsApp-primary.
  // Preserve the legacy widget ID as a WhatsApp fallback, never mislabel it as SMS.
  const smsWidget={
    id:String(env.MSG91_SMS_WIDGET_ID||'').trim(),
    token:String(env.MSG91_SMS_WIDGET_TOKEN||env.MSG91_WIDGET_TOKEN||'').trim()
  };
  const whatsappWidget={
    id:String(env.MSG91_WHATSAPP_WIDGET_ID||env.MSG91_WIDGET_ID||'').trim(),
    token:String(env.MSG91_WHATSAPP_WIDGET_TOKEN||env.MSG91_WIDGET_TOKEN||'').trim()
  };
  const smsEnabled=bridgeReady&&Boolean(smsWidget.id&&smsWidget.token);
  const whatsappEnabled=bridgeReady&&Boolean(whatsappWidget.id&&whatsappWidget.token);
  return {
    enabled:smsEnabled||whatsappEnabled,
    smsEnabled,
    whatsappEnabled,
    widgetId:smsEnabled?smsWidget.id:'',
    widgetToken:smsEnabled?smsWidget.token:'',
    smsWidgetId:smsEnabled?smsWidget.id:'',
    smsWidgetToken:smsEnabled?smsWidget.token:'',
    whatsappWidgetId:whatsappEnabled?whatsappWidget.id:'',
    whatsappWidgetToken:whatsappEnabled?whatsappWidget.token:''
  };
}
function supaUrl(env) {
  const url=new URL(env.SUPABASE_URL || DEFAULT_SUPABASE_URL);
  if(url.protocol!=='https:')throw new Error('Secure Supabase URL required');
  return url.origin;
}
function supaHeaders(env) {return {apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};}
async function supaFetch(env,path,opts={}){
  const r=await fetch(`${supaUrl(env)}${path}`, {method:opts.method||'GET',headers:{...supaHeaders(env),...(opts.headers||{})},body:opts.body===undefined?undefined:JSON.stringify(opts.body),redirect:'manual'});
  const data=await r.json().catch(()=>null);
  return {status:r.status,ok:r.ok,data};
}
async function digestToken(token){
  const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(raw),x=>x.toString(16).padStart(2,'0')).join('');
}
function indiaPhone(value){
  const digits=String(value||'').replace(/^\+/, '');
  return /^91[6-9]\d{9}$/.test(digits)?'+'+digits:null;
}
async function consumeProof(env,hash,phone){
  // Atomic UNIQUE insert: a verification token cannot be exchanged for multiple Supabase sessions.
  const r=await supaFetch(env,'/rest/v1/msg91_otp_redemptions?on_conflict=token_sha256',{
    method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:{token_sha256:hash,phone_e164:phone}
  });
  if(!r.ok)throw new Error('OTP replay-protection database not configured');
  return Array.isArray(r.data)&&r.data.length===1;
}
async function existingIdentity(env,phone){
  const r=await supaFetch(env,`/rest/v1/msg91_phone_identities?phone_e164=eq.${encodeURIComponent(phone)}&select=auth_user_id&limit=1`);
  if(!r.ok)throw new Error('Phone account database unavailable');
  return r.data?.[0]?.auth_user_id || null;
}
async function newIdentity(env,phone,name){
  // Random, non-deliverable alias owned by our domain. We never send OTP to this alias.
  const email=`mobile-${crypto.randomUUID().replaceAll('-','')}@auth.crakkerxai.com`;
  const r=await supaFetch(env,'/auth/v1/admin/users',{method:'POST',body:{
    email,phone,email_confirm:true,phone_confirm:true,
    user_metadata:{full_name:name||'Mobile account',mobile_login:true}
  }});
  const user=r.data?.user||r.data;
  if(!r.ok||!user?.id)throw new Error('Unable to register the verified phone account');
  const row=await supaFetch(env,'/rest/v1/msg91_phone_identities',{method:'POST',body:{phone_e164:phone,auth_user_id:user.id}});
  if(!row.ok)throw new Error('Phone account registration could not be completed');
  return user;
}
async function loadUser(env,userId){
  const r=await supaFetch(env,`/auth/v1/admin/users/${encodeURIComponent(userId)}`);
  const user=r.data?.user||r.data;
  if(!r.ok||!user?.email)throw new Error('Unable to load verified mobile account');
  return user;
}

function normalizedEmail(value) {
  const email=String(value||'').trim().toLowerCase();
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||email.endsWith('@auth.crakkerxai.com'))return null;
  return email;
}
async function verifyMsg91AccessToken(env,accessToken) {
  if(typeof accessToken!=='string'||accessToken.length>4096||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken)) {
    return {ok:false,status:400,code:'INVALID_MSG91_PROOF',message:'The mobile verification expired. Request a new OTP.'};
  }
  let response;
  try {
    response=await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({authkey:env.MSG91_AUTHKEY,'access-token':accessToken}),redirect:'manual'
    });
  } catch(error) {
    return {ok:false,status:502,code:'MSG91_VERIFY_UNREACHABLE',message:'Could not verify the mobile number. Request a fresh OTP and try again.',detail:error?.message};
  }
  if(response.status>=300&&response.status<400)return {ok:false,status:502,code:'MSG91_VERIFY_REDIRECTED',message:'MSG91 verification is temporarily unavailable. Contact support.',detail:`HTTP ${response.status}`};
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.type!=='success')return {ok:false,status:401,code:'MSG91_ACCESS_TOKEN_REJECTED',message:'MSG91 could not confirm this mobile number. Request a fresh OTP.',detail:data?.message||data?.msg||response.status};
  const phone=indiaPhone(data.message?.identifier||data.message?.mobile||data.message?.phone||data.identifier||data.mobile||data.message);
  if(!phone)return {ok:false,status:403,code:'MSG91_PHONE_NOT_CONFIRMED',message:'MSG91 did not return a verified Indian mobile number.'};
  return {ok:true,phone};
}

// Stage one of unified signup/linking: validate the MSG91 proof and create a short-lived,
// one-use pending record. No Supabase user is created until the email is also verified.
export async function prepareMsg91Signup(req,env) {
  const requestId=crypto.randomUUID();
  let stage='prepare_signup';
  const report=(status,code,message,detail='')=>{
    console.error(JSON.stringify({event:'msg91_identity_link_failed',requestId,stage,code,detail:String(detail||'').replace(/[\r\n\t]/g,' ').slice(0,220)}));
    return json({error:message,code,stage,requestId},status);
  };
  try {
    if(!phoneAuthConfig(env).enabled)return report(503,'MSG91_NOT_CONFIGURED','Mobile verification is not configured.');
    let payload;try{payload=JSON.parse(await req.text());}catch{return report(400,'INVALID_JSON','Invalid request.');}
    const email=normalizedEmail(payload?.email);
    const fullName=String(payload?.fullName||'').trim().slice(0,80);
    const channel=payload?.channel==='whatsapp'?'whatsapp':'sms';
    const cfg=phoneAuthConfig(env);
    if(!email)return report(400,'VALID_EMAIL_REQUIRED','Enter a valid email address.');
    if(channel==='sms'&&!cfg.smsEnabled)return report(503,'SMS_NOT_CONFIGURED','SMS verification is not configured.');
    if(channel==='whatsapp'&&!cfg.whatsappEnabled)return report(503,'WHATSAPP_NOT_CONFIGURED','WhatsApp verification is not configured.');
    stage='verify_msg91_access_token';
    const verified=await verifyMsg91AccessToken(env,payload?.accessToken);
    if(!verified.ok)return report(verified.status,verified.code,verified.message,verified.detail);
    stage='store_pending_identity';
    const proofHash=await digestToken(payload.accessToken);
    const row=await supaFetch(env,'/rest/v1/msg91_pending_signups?select=id,expires_at',{
      method:'POST',headers:{Prefer:'return=representation'},
      body:{email,phone_e164:verified.phone,full_name:fullName,channel,proof_sha256:proofHash}
    });
    if(!row.ok||!Array.isArray(row.data)||!row.data[0]?.id){
      const detail=String(row.data?.message||row.data?.details||row.status);
      const duplicate=/duplicate|unique/i.test(detail);
      return report(duplicate?409:503,duplicate?'MSG91_PROOF_ALREADY_USED':'PENDING_IDENTITY_STORE_FAILED',duplicate?'This mobile verification was already used. Request a fresh OTP.':'Could not save the verified mobile step. Please try again.',detail);
    }
    return json({pendingSignupId:row.data[0].id,expiresAt:row.data[0].expires_at,phoneE164:verified.phone});
  } catch(error) {
    return report(500,'IDENTITY_PREPARATION_FAILED','Could not prepare the account link. Please request a new mobile OTP.',error?.message);
  }
}

// Stage two: an already authenticated, email-verified Supabase user claims the
// pending MSG91-verified mobile number. The SQL function also merges legacy
// synthetic mobile-only accounts after both identifiers have been proven.
export async function linkMsg91SignupPhone(req,env,user) {
  const requestId=crypto.randomUUID();
  let stage='validate_email_session';
  const report=(status,code,message,detail='')=>{
    console.error(JSON.stringify({event:'msg91_identity_link_failed',requestId,stage,code,detail:String(detail||'').replace(/[\r\n\t]/g,' ').slice(0,220)}));
    return json({error:message,code,stage,requestId},status);
  };
  try {
    if(!user?.id||!user?.email||!user?.email_confirmed_at)return report(403,'VERIFIED_EMAIL_REQUIRED','Verify your email before linking this mobile number.');
    let payload;try{payload=JSON.parse(await req.text());}catch{return report(400,'INVALID_JSON','Invalid request.');}
    const pendingSignupId=String(payload?.pendingSignupId||'');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pendingSignupId))return report(400,'INVALID_PENDING_LINK','The mobile verification expired. Request a new OTP.');
    stage='link_verified_identity';
    const linked=await supaFetch(env,'/rest/v1/rpc/link_verified_msg91_phone',{
      method:'POST',body:{p_pending_signup_id:pendingSignupId,p_auth_user_id:user.id,p_verified_email:String(user.email).toLowerCase()}
    });
    if(!linked.ok){
      const detail=String(linked.data?.message||linked.data?.details||linked.data?.hint||linked.status);
      if(/PHONE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT/.test(detail))return report(409,'PHONE_ALREADY_LINKED','This mobile number belongs to another account. Sign in to that account or contact support to consolidate it.',detail);
      if(/ACCOUNT_ALREADY_HAS_DIFFERENT_MOBILE/.test(detail))return report(409,'ACCOUNT_HAS_DIFFERENT_MOBILE','This email account already has a different mobile number linked.',detail);
      if(/VERIFIED_EMAIL|EMAIL_MISMATCH/.test(detail))return report(403,'EMAIL_NOT_VERIFIED_FOR_LINK','Verify the same email address used during signup.',detail);
      if(/EXPIRED|NOT_FOUND|ALREADY_USED/.test(detail))return report(409,'MOBILE_LINK_EXPIRED','The mobile verification expired or was already used. Request a fresh OTP.',detail);
      return report(503,'IDENTITY_LINK_FAILED','Your email is verified, but the mobile number could not be linked. Check the unified identity migration and try again.',detail);
    }
    return json({linked:true,phoneE164:linked.data?.phone_e164||null,mergedLegacyAccount:Boolean(linked.data?.merged_legacy_account),requestId});
  } catch(error) {
    return report(500,'IDENTITY_LINK_UNEXPECTED','The verified contacts could not be linked. Please try again.',error?.message);
  }
}

export async function handleMsg91Auth(req,env){
  const requestId=crypto.randomUUID();
  let stage='configuration';
  const report=(status,code,message,detail='')=>{
    // Never log OTPs, access tokens, phone numbers, AuthKeys or widget tokens.
    console.error(JSON.stringify({
      event:'msg91_auth_flow_failed',
      requestId,
      stage,
      code,
      detail:String(detail||'').replace(/[\r\n\t]/g,' ').slice(0,240)
    }));
    return json({error:message,code,stage,requestId},status);
  };

  try {
    if(!phoneAuthConfig(env).enabled) {
      return report(503,'MSG91_NOT_CONFIGURED','Mobile OTP login is not configured on the server.');
    }
    if(Number(req.headers.get('content-length')||0)>8192) {
      return report(413,'REQUEST_TOO_LARGE','Request too large.');
    }

    stage='parse_request';
    let payload;
    try {
      const body=await req.text();
      if(body.length>8192)return report(413,'REQUEST_TOO_LARGE','Request too large.');
      payload=JSON.parse(body);
    } catch {
      return report(400,'INVALID_JSON','Invalid JSON request.');
    }

    if(payload?.signup) return report(400,'UNIFIED_SIGNUP_REQUIRED','Create an account with your name, email and mobile number, then verify both contacts.');
    const accessToken=payload?.accessToken;
    if(typeof accessToken!=='string'||accessToken.length>4096||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken)) {
      return report(400,'INVALID_MSG91_PROOF','MSG91 did not return a valid verification proof. Request a new OTP.');
    }

    stage='verify_msg91_access_token';
    let provider, verified;
    try {
      provider=await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken',{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({authkey:env.MSG91_AUTHKEY,'access-token':accessToken}),
        redirect:'manual'
      });
      if(provider.status>=300 && provider.status<400) {
        return report(502,'MSG91_VERIFY_REDIRECTED','MSG91 returned a redirect while verifying the OTP proof. Check the configured MSG91 verification endpoint and account settings.',`HTTP ${provider.status}`);
      }
      verified=await provider.json().catch(()=>null);
    } catch(error) {
      return report(502,'MSG91_VERIFY_UNREACHABLE','Could not reach MSG91 to verify the OTP proof. Request a fresh OTP and try again.',error?.message);
    }
    if(!provider.ok || verified?.type!=='success') {
      return report(401,'MSG91_ACCESS_TOKEN_REJECTED','MSG91 rejected the verification proof. Check that MSG91_AUTHKEY belongs to the same MSG91 account as the selected widget, then request a fresh OTP.',verified?.message||verified?.msg||provider.status);
    }

    stage='read_verified_phone';
    const phone=indiaPhone(verified.message?.identifier || verified.message?.mobile || verified.message?.phone || verified.identifier || verified.mobile || verified.message);
    if(!phone) {
      return report(403,'MSG91_PHONE_NOT_CONFIRMED','MSG91 verified the OTP but did not return a supported Indian mobile number.');
    }

    // Check the identity before consuming the one-time proof. A normal login
    // attempt for a phone that has never been registered must not burn the OTP.
    stage='lookup_phone_identity';
    let userId;
    try {
      userId=await existingIdentity(env,phone);
    } catch(error) {
      return report(503,'PHONE_IDENTITY_LOOKUP_FAILED','The mobile account lookup failed. Check the MSG91 phone identity table and Supabase service-role configuration.',error?.message);
    }

    let user;
    if(!userId) {
      if(!payload?.signup) {
        return report(404,'PHONE_ACCOUNT_NOT_FOUND','No mobile account is registered for this number. Choose Create account to register it, or sign in with your existing email account and link this mobile number first.');
      }
      stage='create_phone_account';
      try {
        user=await newIdentity(env,phone,String(payload.fullName||'').trim().slice(0,80));
        userId=user.id;
      } catch(error) {
        return report(502,'PHONE_ACCOUNT_CREATE_FAILED','OTP was verified, but Supabase could not create the mobile account. Check Supabase Auth phone sign-up settings and the msg91_phone_identities table before requesting a fresh OTP.',error?.message);
      }
    } else {
      stage='load_phone_account';
      try {
        user=await loadUser(env,userId);
      } catch(error) {
        return report(503,'PHONE_ACCOUNT_LOAD_FAILED','The verified mobile account exists, but Supabase could not load it. Check the service-role key and Auth user record.',error?.message);
      }
    }

    stage='generate_supabase_session_link';
    let link;
    try {
      link=await supaFetch(env,'/auth/v1/admin/generate_link',{
        method:'POST',
        body:{type:'magiclink',email:user.email}
      });
    } catch(error) {
      return report(502,'SUPABASE_LINK_REQUEST_FAILED','The mobile number was verified, but Supabase could not create the login session. Request a fresh OTP after the server issue is corrected.',error?.message);
    }
    const tokenHash=link.data?.hashed_token || link.data?.properties?.hashed_token;
    if(!link.ok||typeof tokenHash!=='string'||!tokenHash) {
      return report(502,'SUPABASE_LINK_REJECTED','The mobile number was verified, but Supabase rejected session creation. Check Supabase Auth and the Worker service-role key.',link.data?.msg||link.data?.message||link.status);
    }

    stage='consume_otp_proof';
    let consumed;
    try {
      consumed=await consumeProof(env,await digestToken(accessToken),phone);
    } catch(error) {
      return report(503,'OTP_REPLAY_STORE_FAILED','Supabase could not record the verified OTP proof. Check the msg91_otp_redemptions table and its service-role permissions.',error?.message);
    }
    if(!consumed) {
      return report(409,'OTP_PROOF_ALREADY_USED','This OTP was already verified. Request a new OTP and use it once.');
    }

    console.log(JSON.stringify({event:'msg91_auth_flow_succeeded',requestId,channel:payload?.channel==='whatsapp'?'whatsapp':'sms'}));
    return json({tokenHash,requestId});
  } catch(error) {
    return report(500,'MSG91_AUTH_UNEXPECTED_ERROR','The OTP was verified, but account sign-in could not be completed. Use the reference code to inspect Worker logs and request a fresh OTP.',error?.message);
  }
}
