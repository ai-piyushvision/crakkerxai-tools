/* Cloudflare Worker API: never put payment or Supabase service-role secrets in client JS. */
import {amountPaise, PAID_PLAN_IDS, getPlan} from '../src/plans.mjs';
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail = (message,status=400)=>json({error:message},status);
const enc=new TextEncoder();
const isSetup=(env)=>Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
const isPaymentReady=(env)=>isSetup(env) && env.PAYMENTS_ENABLED==='true' && Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
const required=(x,name)=>{if(!x)throw new Error(`Missing server configuration: ${name}`);return x;};
function safeUrl(env){const url=new URL(required(env.SUPABASE_URL,'SUPABASE_URL'));if(url.protocol!=='https:')throw new Error('SUPABASE_URL must use https');return url.origin;}
function dbHeaders(env,extra={}){return {'apikey':env.SUPABASE_SERVICE_ROLE_KEY,'Authorization':`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',...extra};}
async function dbRequest(env,path,{method='GET',body,prefer}={}){
 const base=safeUrl(env);
 const response=await fetch(`${base}/rest/v1/${path}`,{method,headers:dbHeaders(env,prefer?{'Prefer':prefer}:{}),body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
 if(!response.ok){console.error('Database operation failed',response.status);throw new Error('Database operation failed');}
 const text=await response.text();return text?JSON.parse(text):null;
}
async function getUser(req,env){
 if(!isSetup(env))return null;
 const bearer=req.headers.get('Authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(bearer))return null;
 const token=bearer.replace(/^Bearer\s+/i,'');
 const response=await fetch(`${safeUrl(env)}/auth/v1/user`,{headers:{'apikey':env.SUPABASE_ANON_KEY,'Authorization':`Bearer ${token}`},redirect:'error'});
 if(!response.ok)return null;
 const user=await response.json();return user?.id&&(user?.email_confirmed_at||user?.phone_confirmed_at)?user:null;
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
  body:opts.body?JSON.stringify(opts.body):undefined,redirect:'error'
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
async function handleApi(req,env){
 const path=new URL(req.url).pathname;
 if(path==='/api/config' && req.method==='GET')return json({
  authEnabled:isSetup(env), paymentsEnabled:isPaymentReady(env),
  supabaseUrl: isSetup(env)?safeUrl(env):'', supabaseAnonKey:isSetup(env)?env.SUPABASE_ANON_KEY:'',
  razorpayKeyId:isPaymentReady(env)?env.RAZORPAY_KEY_ID:''
 });
 if(path==='/api/razorpay/webhook' && req.method==='POST')return webhook(req,env);
 if(!['/api/me','/api/create-order','/api/verify-payment','/api/use-quota'].includes(path))return fail('Not found',404);
 if(!isSetup(env))return fail('Authentication is not configured yet',503);
 const user=await getUser(req,env);
 if(!user)return fail('Please sign in and verify your email or mobile number',401);
 if(path==='/api/me' && req.method==='GET'){
  const memberships=await dbRequest(env,`memberships?user_id=eq.${encodeURIComponent(user.id)}&select=plan,expires_at&limit=1`);
  const history=await dbRequest(env,`payment_orders?user_id=eq.${encodeURIComponent(user.id)}&state=eq.paid&select=plan,amount_paise,paid_at,razorpay_order_id&order=paid_at.desc&limit=10`);
  const current=memberships?.[0];const active=current&&Date.parse(current.expires_at)>Date.now();
  return json({user:{id:user.id,email:user.email},plan:active?getPlan(current.plan).id:'free',expiresAt:active?current.expires_at:null,history:history||[]});
 }
 if(path==='/api/use-quota' && req.method==='POST'){
  if(!isPaymentReady(env))return json({ok:true,unmetered:true}); // free tools retain functionality before paid launch
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
   catch(err){console.error('API error',String(err?.message||err));return fail('Unable to complete this request. Please try again.',500)}
  }
  return env.ASSETS.fetch(req);
 }
};
