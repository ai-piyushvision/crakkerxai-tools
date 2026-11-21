/* Cloudflare Worker API: never put payment or Supabase service-role secrets in client JS. */
import {amountPaise, PAID_PLAN_IDS, getPlan} from '../src/plans.mjs';
import {phoneAuthConfig,handleMsg91Auth,prepareMsg91Signup,linkMsg91SignupPhone} from './msg91-auth.js';
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail = (message,status=400)=>json({error:message},status);
const enc=new TextEncoder();
// These two values are public Supabase project credentials. A browser login does
// NOT require the server-side service-role key. Keep that key for private DB writes only.
const PUBLIC_SUPABASE_URL='https://knhduwfwngrffnlxbnwt.supabase.co';
const PUBLIC_SUPABASE_KEY='sb_publishable_sIQ_gPy9T64vg0M0L_Ff1w_c4NhturO';
const publicSupabase=(env)=>({
 url:String(env.SUPABASE_URL||PUBLIC_SUPABASE_URL).trim(),
 key:String(env.SUPABASE_ANON_KEY||PUBLIC_SUPABASE_KEY).trim()
});
const isAuthReady=(env)=>{
 const cfg=publicSupabase(env);
 const hasProjectOverride=Boolean(env.SUPABASE_URL||env.SUPABASE_ANON_KEY);
 const completeProjectOverride=!hasProjectOverride||Boolean(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY);
 return completeProjectOverride && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url) && Boolean(cfg.key);
};
const isSetup=(env)=>isAuthReady(env) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
const isPaymentReady=(env)=>isSetup(env) && env.PAYMENTS_ENABLED==='true' && Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
const required=(x,name)=>{if(!x)throw new Error(`Missing server configuration: ${name}`);return x;};
function safeUrl(env){const url=new URL(required(publicSupabase(env).url,'SUPABASE_URL'));if(url.protocol!=='https:')throw new Error('SUPABASE_URL must use https');return url.origin;}
function dbHeaders(env,extra={}){return {'apikey':env.SUPABASE_SERVICE_ROLE_KEY,'Authorization':`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',...extra};}
async function dbRequest(env,path,{method='GET',body,prefer}={}){
 const base=safeUrl(env);
 const response=await fetch(`${base}/rest/v1/${path}`,{method,headers:dbHeaders(env,prefer?{'Prefer':prefer}:{}),body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 if(!response.ok){console.error('Database operation failed',response.status);throw new Error('Database operation failed');}
 const text=await response.text();return text?JSON.parse(text):null;
}
async function getUser(req,env){
 if(!isAuthReady(env))return null;
 const bearer=req.headers.get('Authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(bearer))return null;
 const token=bearer.replace(/^Bearer\s+/i,'');
 let response;
 try{
  response=await fetch(`${safeUrl(env)}/auth/v1/user`,{headers:{'apikey':publicSupabase(env).key,'Authorization':`Bearer ${token}`},redirect:'manual'});
 }catch(error){
  console.error('Supabase Auth session validation could not reach the project');
  throw new Error('Could not contact the configured Supabase Auth project. Check the Worker SUPABASE_URL and matching SUPABASE_ANON_KEY.');
 }
 if(!response.ok)return null;
 const user=await response.json();return user?.id&&(user?.email_confirmed_at||user?.phone_confirmed_at)?user:null;
}
const PASSWORD_HUMAN_HOLD_MS = 1600;
const PASSWORD_HUMAN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
async function clientIpHash(req){
 const ip=String(req.headers.get('CF-Connecting-IP')||'unknown').trim();
 const digest=await crypto.subtle.digest('SHA-256',enc.encode(ip));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function createPasswordHumanChallenge(req,env){
 if(req.method!=='POST')return fail('Method not allowed',405);
 if(!isSetup(env))return fail('Human verification is temporarily unavailable. Please try again later.',503);
 try{
  const ipHash=await clientIpHash(req);
  const now=Date.now();
  const recent=await dbRequest(env,`auth_human_challenges?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(new Date(now-10*60*1000).toISOString())}&select=challenge_id&limit=10`);
  if((recent||[]).length>=10)return fail('Too many security checks. Please wait a few minutes and try again.',429);
  // Keep the challenge table small without deleting recent or in-flight checks.
  await dbRequest(env,`auth_human_challenges?expires_at=lt.${encodeURIComponent(new Date(now-24*60*60*1000).toISOString())}`,{method:'DELETE'});
  const challengeId=crypto.randomUUID();
  const createdAt=new Date(now).toISOString();
  const expiresAt=new Date(now+PASSWORD_HUMAN_CHALLENGE_TTL_MS).toISOString();
  await dbRequest(env,'auth_human_challenges',{method:'POST',body:{challenge_id:challengeId,ip_hash:ipHash,challenge_type:'pool_hold_confirm',created_at:createdAt,expires_at:expiresAt,used_at:null},prefer:'return=minimal'});
  return json({challengeId,createdAt,expiresAt,minimumHoldMs:PASSWORD_HUMAN_HOLD_MS,style:'pool-hold-confirm'});
 }catch(error){
  console.error('Password human challenge creation failed:',String(error?.message||error));
  return fail('Could not start human verification. Please refresh the check and try again.',503);
 }
}
async function consumePasswordHumanChallenge(req,env,payload){
 const challengeId=String(payload?.challengeId||'');
 const heldMs=Number(payload?.heldMs);
 if(!/^[0-9a-f-]{36}$/i.test(challengeId)||!Number.isFinite(heldMs)||heldMs<PASSWORD_HUMAN_HOLD_MS||heldMs>10000){
  return {ok:false,response:fail('Complete the human check before signing in.',403)};
 }
 const ipHash=await clientIpHash(req);
 const now=Date.now();
 const rows=await dbRequest(env,`auth_human_challenges?challenge_id=eq.${encodeURIComponent(challengeId)}&ip_hash=eq.${ipHash}&challenge_type=eq.pool_hold_confirm&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}&select=challenge_id,created_at,expires_at&limit=1`);
 const challenge=rows?.[0];
 if(!challenge)return {ok:false,response:fail('Human check expired or already used. Please verify again.',403)};
 const createdAt=Date.parse(challenge.created_at);
 if(!Number.isFinite(createdAt)||now-createdAt<PASSWORD_HUMAN_HOLD_MS-100){
  return {ok:false,response:fail('Keep holding the confirmation control until it completes.',403)};
 }
 const consumed=await dbRequest(env,`auth_human_challenges?challenge_id=eq.${encodeURIComponent(challengeId)}&ip_hash=eq.${ipHash}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date(now).toISOString())}`,{method:'PATCH',body:{used_at:new Date(now).toISOString()},prefer:'return=representation'});
 if(!Array.isArray(consumed)||consumed.length!==1)return {ok:false,response:fail('Human check has already been used. Please verify again.',409)};
 return {ok:true};
}
async function handlePasswordLogin(req,env){
 if(req.method!=='POST')return fail('Method not allowed',405);
 if(!isSetup(env))return fail('Password sign-in is temporarily unavailable. Please try again later.',503);
 let payload;try{payload=await readBody(req);}catch{return fail('Invalid sign-in request.',400);}
 const identityType=String(payload?.identityType||'email');
 const password=String(payload?.password||'');
 if(!password||password.length>256)return fail('Enter your password.',400);
 if(!['email','phone'].includes(identityType))return fail('Choose an email address or mobile number.',400);
 const consumed=await consumePasswordHumanChallenge(req,env,payload);
 if(!consumed.ok)return consumed.response;
 try{
  let email='';
  if(identityType==='email'){
   email=String(payload?.identity||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail('Enter a valid email address.',400);
  }else{
   const phone=String(payload?.identity||'').replace(/[\s()-]/g,'');
   if(!/^\+91[6-9]\d{9}$/.test(phone))return fail('Enter a valid mobile number.',400);
   const rows=await dbRequest(env,`msg91_phone_identities?phone_e164=eq.${encodeURIComponent(phone)}&select=auth_user_id&limit=1`);
   const userId=rows?.[0]?.auth_user_id;
   if(!userId)return fail('Mobile number or password is incorrect.',401);
   const admin=await fetch(`${safeUrl(env)}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},redirect:'manual'});
   const adminData=await admin.json().catch(()=>null);const authUser=adminData?.user||adminData;
   if(!admin.ok||!authUser?.email)return fail('Mobile number or password is incorrect.',401);
   email=String(authUser.email).trim().toLowerCase();
  }
  const login=await fetch(`${safeUrl(env)}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:publicSupabase(env).key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({email,password}),redirect:'manual'});
  const authData=await login.json().catch(()=>null);
  if(!login.ok||!authData?.access_token||!authData?.refresh_token)return fail('Email, mobile number or password is incorrect.',401);
  return json({access_token:authData.access_token,refresh_token:authData.refresh_token,expires_in:authData.expires_in,token_type:authData.token_type||'bearer'});
 }catch(error){
  console.error('Password sign-in failed after human check:',String(error?.message||error));
  return fail('Sign-in is temporarily unavailable. Please try again.',503);
 }
}

async function handlePhonePasswordLogin(req,env){
 // Backwards-compatible alias. The common handler still requires a fresh,
 // server-issued human challenge before it will attempt password authentication.
 const payload=await readBody(req).catch(()=>null);
 if(!payload)return fail('Invalid sign-in request.',400);
 return handlePasswordLogin(new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({...payload,identityType:'phone',identity:payload.identity||payload.phone})}),env);
}

async function getPasswordPolicy(env,userId){
 if(!isSetup(env))throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from the Cloudflare Worker secrets.');
 let rows;
 try{rows=await dbRequest(env,`account_password_security?user_id=eq.${encodeURIComponent(userId)}&select=password_changed_at,password_setup_required,password_setup_reason&limit=1`);}
 catch{throw new Error('The account_password_security table is unavailable. Run supabase/migrations/20261120_account_password_policy.sql in the same Supabase project used by this website, then redeploy the Worker.');}
 const row=rows?.[0]||null;
 const changedAt=row?.password_changed_at||null;
 const ageMs=changedAt?Math.max(0,Date.now()-Date.parse(changedAt)):null;
 const ageDays=ageMs===null?null:Math.floor(ageMs/86400000);
 const setupRequired=row?Boolean(row.password_setup_required):true;
 return {passwordSet:Boolean(changedAt),passwordChangedAt:changedAt,passwordAgeDays:ageDays,passwordSetupRequired:setupRequired,passwordSetupReason:row?.password_setup_reason||'initial_setup',mustSetPassword:setupRequired||!changedAt||ageMs>=60*86400000,passwordMaxAgeDays:60};
}
async function passwordPolicyTableReady(env){
 if(!isSetup(env))return false;
 try{
  await dbRequest(env,'account_password_security?select=password_changed_at,password_setup_required,password_setup_reason&limit=0');
  return true;
 }catch{return false;}
}
async function verifyCurrentPassword(req,env,user){
 if(req.method!=='POST')return fail('Method not allowed',405);
 let payload;try{payload=await readBody(req);}catch{return fail('Invalid password verification request.',400);}
 const password=String(payload?.password||'');
 if(!password||password.length>256)return fail('Enter your current password.',400);
 const email=String(user?.email||'').trim();
 if(!email)return fail('This account does not have a password sign-in identity. Contact support.',400);
 try{
  // Validate the password against this already-authenticated user's private
  // Supabase email identity. Do not return or store the token from this check.
  const response=await fetch(`${safeUrl(env)}/auth/v1/token?grant_type=password`,{
   method:'POST',
   headers:{apikey:publicSupabase(env).key,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({email,password}),
   redirect:'manual'
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.user?.id||result.user.id!==user.id){
   return fail('Current password is incorrect. Check your old password and try again.',401);
  }
  return json({verified:true});
 }catch(error){
  console.error('Current-password verification could not be completed');
  return fail('Could not verify the current password with Supabase. Check the Worker project configuration and try again.',503);
 }
}
async function readBody(req){
 const size=Number(req.headers.get('content-length')||0);
 if(size>16384)throw new Error('Request too large');
 const text=await req.text();if(text.length>16384)throw new Error('Request too large');
 return JSON.parse(text);
}
async function hmacHex(secret,message){
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,enc.encode(message));
 return Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');
}
function sameHex(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length||! /^[a-f0-9]{64}$/i.test(a)||! /^[a-f0-9]{64}$/i.test(b))return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
async function razorpay(env,path,opts={}){
 const response=await fetch(`https://api.razorpay.com/v1/${path}`,{
  method:opts.method||'GET',headers:{'Authorization':`Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,'Content-Type':'application/json'},
  body:opts.body?JSON.stringify(opts.body):undefined,redirect:'manual'
 });
 if(!response.ok){console.error('Razorpay request failed',response.status);throw new Error('Payment provider unavailable');}
 return response.json();
}
async function orderFor(env,orderId,userId){
 const filter=`payment_orders?razorpay_order_id=eq.${encodeURIComponent(orderId)}${userId?`&user_id=eq.${encodeURIComponent(userId)}`:''}&select=razorpay_order_id,user_id,plan,amount_paise,state,payment_id&limit=1`;
 const rows=await dbRequest(env,filter);return rows?.[0]||null;
}
async function grantVerifiedPayment(env,order,payment){
 if(!order || order.state==='refunded')throw new Error('Payment order not eligible');
 if(payment.order_id!==order.razorpay_order_id || payment.currency!=='INR' || payment.amount!==order.amount_paise || payment.status!=='captured')throw new Error('Payment is not captured or amount mismatch');
 return dbRequest(env,'rpc/activate_paid_order',{method:'POST',body:{p_order_id:order.razorpay_order_id,p_payment_id:payment.id}});
}
async function webhook(req,env){
 if(!env.RAZORPAY_WEBHOOK_SECRET)return fail('Webhook not configured',503);
 const body=await req.text();if(body.length>262144)return fail('Payload too large',413);
 const signature=req.headers.get('x-razorpay-signature')||'';
 if(!sameHex(await hmacHex(env.RAZORPAY_WEBHOOK_SECRET,body),signature))return fail('Invalid webhook signature',401);
 let event;try{event=JSON.parse(body)}catch{return fail('Invalid webhook body')}
 if(!['payment.captured','payment.refunded'].includes(event.event))return json({ok:true,ignored:true});
 const payment=event.payload?.payment?.entity;
 if(!payment?.order_id || !payment?.id)return fail('Missing payment details');
 const order=await orderFor(env,payment.order_id);
 if(!order)return json({ok:true,ignored:true});
 if(event.event==='payment.refunded'){
  if(payment.status==='refunded' && Number(payment.amount_refunded)>=Number(payment.amount) && (!order.payment_id || order.payment_id===payment.id)){
   await dbRequest(env,'rpc/revoke_refunded_order',{method:'POST',body:{p_order_id:order.razorpay_order_id,p_payment_id:payment.id}});
  }
  return json({ok:true});
 }
 await grantVerifiedPayment(env,order,payment);
 return json({ok:true});
}
async function handlePythonApi(req,env){
 if(!env.PYTHON_API_URL)return fail('Python API is not configured. Set PYTHON_API_URL in Cloudflare Worker variables.',503);
 const incoming=new URL(req.url);
 const base=new URL(env.PYTHON_API_URL);
 if(base.protocol!=='https:' && base.hostname!=='localhost' && base.hostname!=='127.0.0.1')return fail('Python API URL must use HTTPS.',500);
 const target=new URL(incoming.pathname+incoming.search,base);
 const headers=new Headers();
 for(const key of ['Accept','Content-Type']){const value=req.headers.get(key);if(value)headers.set(key,value);}
 const clientIp=req.headers.get('CF-Connecting-IP');if(clientIp)headers.set('X-Crakk-Client-IP',clientIp);
 if(env.PYTHON_API_SECRET)headers.set('X-Internal-API-Key',env.PYTHON_API_SECRET);
 const upstream=await fetch(target.toString(),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body,redirect:'manual'});
 if(upstream.status>=300 && upstream.status<400)return fail('The configured Python API returned an unexpected redirect. Check PYTHON_API_URL.',502);
 const responseHeaders=new Headers(upstream.headers);
 responseHeaders.set('X-Content-Type-Options','nosniff');
 responseHeaders.set('Cache-Control', incoming.pathname==='/api/ai/updates' && incoming.searchParams.has('refresh') ? 'private, no-store' : 'public, max-age=60, s-maxage=300');
 return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
}

async function sha256Hex(value){
 const digest=await crypto.subtle.digest('SHA-256',enc.encode(value));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function handleFeedback(req,env){
 if(req.method!=='POST')return fail('Method not allowed',405);
 if(!isSetup(env))return fail('Feedback is temporarily unavailable. Please try again later.',503);
 const origin=req.headers.get('Origin');
 if(origin && origin!==new URL(req.url).origin)return fail('Invalid request origin',403);
 let data;try{data=await readBody(req)}catch{return fail('Invalid or oversized request',400)}
 const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
 if(clean(data.company_website,200))return json({ok:true,reference:'received'} ,201);
 const name=clean(data.name,100),email=clean(data.email,254).toLowerCase(),phone=clean(data.phone,24),whatsapp=clean(data.whatsapp,24);
 const category=clean(data.category,24),subject=clean(data.subject,140),message=clean(data.message,5000),pageUrl=clean(data.page_url,500);
 if(!name||!/^\S+@\S+\.\S+$/.test(email)||!phone||!subject||message.length<10||data.consent!==true)return fail('Please complete all required fields and provide a valid email and message.',400);
 if(!['feedback','bug','feature','support','business'].includes(category))return fail('Invalid feedback category',400);
 if(!/^[+()\d .-]{7,24}$/.test(phone)|| (whatsapp&&!/^[+()\d .-]{7,24}$/.test(whatsapp)))return fail('Please enter a valid contact or WhatsApp number.',400);
 if(pageUrl){try{const u=new URL(pageUrl);if(u.protocol!=='https:')return fail('Page URL must use HTTPS.',400)}catch{return fail('Please enter a valid page URL.',400)}}
 const ip=req.headers.get('CF-Connecting-IP')||'unknown';const ipHash=await sha256Hex(ip);
 const recent=await dbRequest(env,`feedback_submissions?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(new Date(Date.now()-15*60*1000).toISOString())}&select=id&limit=3`);
 if((recent||[]).length>=3)return fail('Too many submissions. Please wait a few minutes and try again.',429);
 const rows=await dbRequest(env,'feedback_submissions',{method:'POST',body:{name,email,phone,whatsapp:whatsapp||null,category,subject,message,page_url:pageUrl||null,ip_hash:ipHash},prefer:'return=representation'});
 const row=rows?.[0];
 if(env.RESEND_API_KEY&&env.FEEDBACK_NOTIFY_EMAIL&&env.FEEDBACK_FROM_EMAIL){
  try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.FEEDBACK_FROM_EMAIL,to:[env.FEEDBACK_NOTIFY_EMAIL],reply_to:email,subject:`[CrakkerXworld.AI ${category.toUpperCase()}] ${subject}`,text:`Reference: ${row?.id||'submitted'}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nWhatsApp: ${whatsapp||'Not provided'}\nCategory: ${category}\nPage: ${pageUrl||'Not provided'}\n\n${message}`})})}catch(error){console.error('Feedback notification delivery failed')}
 }
 return json({ok:true,reference:row?.id||'received'},201);
}


const ACCOUNT_PREFERENCE_DEFAULTS = Object.freeze({
 theme: 'dark',
 font_size: 'normal',
 notifications_security: true,
 notifications_product: true,
 notifications_email: true,
 location_enabled: false,
 reduced_motion: false
});
const ACCOUNT_PREFERENCE_FIELDS = Object.keys(ACCOUNT_PREFERENCE_DEFAULTS);
function cleanAccountPreferences(row={}){
 const result={...ACCOUNT_PREFERENCE_DEFAULTS};
 if(row.theme==='light'||row.theme==='dark')result.theme=row.theme;
 if(['small','normal','large','extra-large'].includes(row.font_size))result.font_size=row.font_size;
 for(const key of ACCOUNT_PREFERENCE_FIELDS){
  if(key==='theme'||key==='font_size')continue;
  if(typeof row[key]==='boolean')result[key]=row[key];
 }
 return result;
}
async function handleAccountPreferences(req,env,user){
 if(!isSetup(env))return fail('Account settings are temporarily unavailable. Please try again later.',503);
 if(req.method==='GET'){
  const rows=await dbRequest(env,`account_preferences?user_id=eq.${encodeURIComponent(user.id)}&select=theme,font_size,notifications_security,notifications_product,notifications_email,location_enabled,reduced_motion&limit=1`);
  return json({preferences:cleanAccountPreferences(rows?.[0]||{})});
 }
 if(req.method!=='PATCH'&&req.method!=='PUT')return fail('Method not allowed',405);
 let payload;try{payload=await readBody(req);}catch{return fail('Invalid settings request.',400);}
 const incoming=payload?.preferences&&typeof payload.preferences==='object'?payload.preferences:payload;
 const patch={user_id:user.id,updated_at:new Date().toISOString()};
 if(Object.hasOwn(incoming||{},'theme')){
  if(!['dark','light'].includes(incoming.theme))return fail('Choose Morning Mode or Night Mode.',400);
  patch.theme=incoming.theme;
 }
 if(Object.hasOwn(incoming||{},'font_size')){
  if(!['small','normal','large','extra-large'].includes(incoming.font_size))return fail('Choose a supported font size.',400);
  patch.font_size=incoming.font_size;
 }
 for(const key of ['notifications_security','notifications_product','notifications_email','location_enabled','reduced_motion']){
  if(Object.hasOwn(incoming||{},key)){
   if(typeof incoming[key]!=='boolean')return fail(`Invalid ${key} setting.`,400);
   patch[key]=incoming[key];
  }
 }
 if(Object.keys(patch).length<=2)return fail('No supported settings were supplied.',400);
 const rows=await dbRequest(env,'account_preferences?on_conflict=user_id',{method:'POST',body:patch,prefer:'resolution=merge-duplicates,return=representation'});
 return json({saved:true,preferences:cleanAccountPreferences(rows?.[0]||patch)});
}

async function handleIdentityStatus(env,user){
 if(!isSetup(env))return fail('Account linking is not configured. Apply the unified identity migration.',503);
 const rows=await dbRequest(env,`msg91_phone_identities?auth_user_id=eq.${encodeURIComponent(user.id)}&select=phone_e164&limit=1`);
 const phone=rows?.[0]?.phone_e164||null;
 const email=String(user.email||'').toLowerCase();
 const syntheticEmail=/^mobile-[0-9a-f]{32}@auth\.crakkerxai\.com$/i.test(email);
 return json({email:email||null,emailVerified:Boolean(user.email_confirmed_at),phone,phoneVerified:Boolean(phone),syntheticEmail});
}

async function handleApi(req,env){
 const path=new URL(req.url).pathname;
 if(path==='/api/feedback')return handleFeedback(req,env);
 if((path==='/api/search'||path.startsWith('/api/ai/')) && req.method==='GET')return handlePythonApi(req,env);
 if(path.startsWith('/api/tools/') && req.method==='POST')return handlePythonApi(req,env);
 if(path==='/api/config' && req.method==='GET')return json({
  authEnabled:isAuthReady(env), serverDatabaseEnabled:isSetup(env), passwordPolicyReady:await passwordPolicyTableReady(env), paymentsEnabled:isPaymentReady(env),
  supabaseUrl: isAuthReady(env)?safeUrl(env):'', supabaseAnonKey:isAuthReady(env)?publicSupabase(env).key:'',
  razorpayKeyId:isPaymentReady(env)?env.RAZORPAY_KEY_ID:'',
  msg91Enabled:phoneAuthConfig(env).enabled,
  msg91WidgetId:phoneAuthConfig(env).widgetId,
  msg91WidgetToken:phoneAuthConfig(env).widgetToken,
  msg91SmsEnabled:phoneAuthConfig(env).smsEnabled,
  msg91SmsWidgetId:phoneAuthConfig(env).smsWidgetId,
  msg91SmsWidgetToken:phoneAuthConfig(env).smsWidgetToken,
  msg91WhatsappEnabled:phoneAuthConfig(env).whatsappEnabled,
  msg91WhatsappWidgetId:phoneAuthConfig(env).whatsappWidgetId,
  msg91WhatsappWidgetToken:phoneAuthConfig(env).whatsappWidgetToken
 });
 if(path==='/api/razorpay/webhook' && req.method==='POST')return webhook(req,env);
 if(path==='/api/auth/msg91' && req.method==='POST')return handleMsg91Auth(req,env);
 if(path==='/api/auth/msg91/prepare-signup' && req.method==='POST')return prepareMsg91Signup(req,env);
 if(path==='/api/auth/password-human-challenge' && req.method==='POST')return createPasswordHumanChallenge(req,env);
 if(path==='/api/auth/password-login' && req.method==='POST')return handlePasswordLogin(req,env);
 if(path==='/api/auth/phone-password' && req.method==='POST')return handlePhonePasswordLogin(req,env);
 if(!['/api/account/preferences','/api/me','/api/create-order','/api/verify-payment','/api/use-quota','/api/auth/password-policy','/api/auth/verify-current-password','/api/auth/identity-status','/api/auth/msg91/link-signup'].includes(path))return fail('Not found',404);
 if(!isAuthReady(env))return fail('Supabase authentication is not configured yet. Check the project URL and publishable/anon key.',503);
 const user=await getUser(req,env);
 if(!user)return fail('Please sign in again and verify your email or mobile number.',401);
 if(path==='/api/auth/verify-current-password')return verifyCurrentPassword(req,env,user);
 if(path==='/api/account/preferences')return handleAccountPreferences(req,env,user);
 if(path==='/api/auth/identity-status' && req.method==='GET'){
  try{return await handleIdentityStatus(env,user);}
  catch(error){console.error('Account identity status unavailable:',String(error?.message||error));return fail('Could not load your linked sign-in methods. Please refresh and try again.',503);}
 }
 if(path==='/api/auth/msg91/link-signup' && req.method==='POST')return linkMsg91SignupPhone(req,env,user);
 if(path==='/api/auth/password-policy' && req.method==='GET'){
  try{return json(await getPasswordPolicy(env,user.id));}
  catch(error){
   console.error('Password policy unavailable:',String(error?.message||error));
   return fail(error?.message||'Password policy check failed. Verify Worker secrets and the Supabase password-policy migration.',503);
  }
 }
 if(path==='/api/me' && req.method==='GET'){
  const fullName=String(user.user_metadata?.full_name||user.user_metadata?.name||user.user_metadata?.preferred_name||'').trim();
  let phone=user.phone||null;
  let memberships=[],history=[];
  if(isSetup(env)){
   const identities=await dbRequest(env,`msg91_phone_identities?auth_user_id=eq.${encodeURIComponent(user.id)}&select=phone_e164&limit=1`).catch(()=>[]);
   phone=identities?.[0]?.phone_e164||phone;
   memberships=await dbRequest(env,`memberships?user_id=eq.${encodeURIComponent(user.id)}&select=plan,expires_at&limit=1`);
   history=await dbRequest(env,`payment_orders?user_id=eq.${encodeURIComponent(user.id)}&state=eq.paid&select=plan,amount_paise,paid_at,razorpay_order_id&order=paid_at.desc&limit=10`);
  }
  const current=memberships?.[0];const active=current&&Date.parse(current.expires_at)>Date.now();
  return json({user:{id:user.id,email:user.email||null,phone,fullName:fullName||null,createdAt:user.created_at||null,emailVerified:Boolean(user.email_confirmed_at),phoneVerified:Boolean(phone)},plan:active?getPlan(current.plan).id:'free',expiresAt:active?current.expires_at:null,history:history||[]});
 }
 if(path==='/api/use-quota' && req.method==='POST'){
  if(!isPaymentReady(env))return json({ok:true,unmetered:true}); // Free tools remain usable before paid launch
  const membership=await dbRequest(env,`memberships?user_id=eq.${encodeURIComponent(user.id)}&select=plan,expires_at&limit=1`);
  const current=membership?.[0];
  const plan=current && Date.parse(current.expires_at)>Date.now()?getPlan(current.plan):getPlan('free');
  if(plan.daily===null)return json({ok:true,unlimited:true});
  const allowed=await dbRequest(env,'rpc/try_consume_usage',{method:'POST',body:{p_user_id:user.id,p_daily_limit:plan.daily}});
  return allowed===true?json({ok:true}):fail('Your daily conversion limit has been reached. Upgrade or come back tomorrow (UTC).',429);
 }
 if(!isPaymentReady(env))return fail('Payments are not activated yet',503);
 if(req.method!=='POST')return fail('Method not allowed',405);
 const payload=await readBody(req);
 if(path==='/api/create-order'){
  const plan=payload?.plan;
  if(!PAID_PLAN_IDS.includes(plan))return fail('Invalid plan');
  const amount=amountPaise(plan);
  const created=await razorpay(env,'orders',{method:'POST',body:{amount,currency:'INR',receipt:crypto.randomUUID().replaceAll('-','').slice(0,30),notes:{plan}}});
  if(!created.id || created.currency!=='INR' || created.amount!==amount)throw new Error('Payment provider returned an invalid order');
  await dbRequest(env,'payment_orders',{method:'POST',body:{razorpay_order_id:created.id,user_id:user.id,plan,amount_paise:amount,state:'created'},prefer:'return=minimal'});
  return json({orderId:created.id,amount,currency:'INR',keyId:env.RAZORPAY_KEY_ID,plan});
 }
 if(path==='/api/verify-payment'){
  const {razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:signature}=payload||{};
  if(!/^order_[A-Za-z0-9]+$/.test(orderId||'')||!/^pay_[A-Za-z0-9]+$/.test(paymentId||''))return fail('Invalid payment identifiers');
  const expected=await hmacHex(env.RAZORPAY_KEY_SECRET,`${orderId}|${paymentId}`);
  if(!sameHex(expected,signature))return fail('Invalid payment signature',401);
  const order=await orderFor(env,orderId,user.id);
  if(!order)return fail('Order does not belong to this account',403);
  const payment=await razorpay(env,`payments/${encodeURIComponent(paymentId)}`);
  await grantVerifiedPayment(env,order,payment);
  return json({ok:true,plan:order.plan});
 }
 return fail('Method not allowed',405);
}
export default {
 async fetch(req,env){
  const path=new URL(req.url).pathname;
  if(path.startsWith('/api/')){
   try{return await handleApi(req,env)}
   catch(err){
    console.error('API request failed:',path,String(err?.message||err));
    if(path==='/api/auth/password-policy')return fail('The password-policy check could not reach Supabase. Verify that the Worker URL/key match this website and that the password-policy migration is installed.',503);
    if(path==='/api/auth/verify-current-password')return fail('Current-password verification is temporarily unavailable. Verify the Worker Supabase configuration and retry.',503);
    return fail('Unable to complete this request. Please try again.',500);
   }
  }
  return env.ASSETS.fetch(req);
 }
};
