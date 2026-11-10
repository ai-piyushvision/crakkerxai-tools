/* Cloudflare Worker MSG91 -> Supabase bridge. Never trust client-supplied phone identity. */
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'
}});
const fail = (message,status=400) => json({error:message},status);
const WIDGET_ID='366b6a64745a343733373331';
export function phoneAuthConfig(env) {
  const enabled=Boolean(env.MSG91_AUTHKEY && env.MSG91_WIDGET_TOKEN && env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
  return {enabled, widgetId:env.MSG91_WIDGET_ID || WIDGET_ID, widgetToken:enabled ? env.MSG91_WIDGET_TOKEN : ''};
}
function supaUrl(env) {
  const url=new URL(env.SUPABASE_URL);
  if(url.protocol!=='https:')throw new Error('Secure Supabase URL required');
  return url.origin;
}
function supaHeaders(env) {return {apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};}
async function supaFetch(env,path,opts={}){
  const r=await fetch(`${supaUrl(env)}${path}`, {method:opts.method||'GET',headers:{...supaHeaders(env),...(opts.headers||{})},body:opts.body===undefined?undefined:JSON.stringify(opts.body),redirect:'error'});
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
export async function handleMsg91Auth(req,env){
  if(!phoneAuthConfig(env).enabled)return fail('MSG91 mobile login is not configured',503);
  if(Number(req.headers.get('content-length')||0)>8192)return fail('Request too large',413);
  let payload;
  try{const body=await req.text();if(body.length>8192)return fail('Request too large',413);payload=JSON.parse(body);}catch{return fail('Invalid JSON request');}
  const accessToken=payload?.accessToken;
  if(typeof accessToken!=='string'||accessToken.length>4096||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken))return fail('Invalid MSG91 verification token');
  const provider=await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken',{
    method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({authkey:env.MSG91_AUTHKEY,'access-token':accessToken}),redirect:'error'
  });
  const verified=await provider.json().catch(()=>null);
  if(!provider.ok || verified?.type!=='success')return fail('Mobile OTP verification failed',401);
  const phone=indiaPhone(verified.message?.identifier || verified.message?.mobile || verified.message?.phone || verified.identifier || verified.mobile || verified.message);
  if(!phone)return fail('MSG91 did not confirm a supported Indian mobile number',403);
  if(!await consumeProof(env,await digestToken(accessToken),phone))return fail('This verification was already used. Request another OTP.',409);
  let userId=await existingIdentity(env,phone);
  if(!userId && !payload.signup)return fail('No mobile account exists. Choose Create account.',404);
  const name=String(payload.fullName||'').trim().slice(0,80);
  const user=userId?await loadUser(env,userId):await newIdentity(env,phone,name);
  const link=await supaFetch(env,'/auth/v1/admin/generate_link',{method:'POST',body:{type:'magiclink',email:user.email}});
  const tokenHash=link.data?.hashed_token || link.data?.properties?.hashed_token;
  if(!link.ok||typeof tokenHash!=='string'||!tokenHash)throw new Error('Unable to complete mobile login');
  // A hash for a single-use Supabase verification; the browser exchanges it for a real Supabase session.
  return json({tokenHash});
}
