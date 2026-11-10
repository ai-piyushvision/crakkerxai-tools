import {PLANS,PAID_PLAN_IDS} from './plans.mjs';
import {appConfig,supabaseClient,getSession,apiRequest} from './auth-client.js';
import {normalizeOtpEmail,normalizeOtpPhone,normalizeOtpCode,maskOtpDestination} from './otp-utils.mjs';
const el=(id)=>document.getElementById(id);
const hide=(id,hidden=true)=>el(id)?.classList.toggle('hidden',hidden);
const label=(id,value)=>{if(el(id))el(id).textContent=value;};
const redirectUrl=()=>`${location.origin}/account/`;
let mode='login';let authMethod='email-otp';let otpContext=null;let client;let config;let pending='';let buying=false;
function notice(message,problem=false){const node=el('account-notice');node.textContent=message;node.classList.toggle('hidden',!message);node.classList.toggle('account-error',problem);}
function setMethod(next){
 authMethod=next;otpContext=null;
 for(const method of ['email-otp','phone-otp','password']){
  const button=el('method-'+method);button.classList.toggle('active',method===authMethod);
  button.setAttribute('aria-pressed',String(method===authMethod));
 }
 const isPhone=authMethod==='phone-otp';const isPassword=authMethod==='password';
 hide('phone-field',!isPhone);hide('email-field',isPhone);hide('password-field',!isPassword);
 el('auth-phone').required=isPhone;el('auth-email').required=!isPhone;el('auth-password').required=isPassword;
 el('auth-password').autocomplete=mode==='signup'?'new-password':'current-password';
 hide('forgot-password',!(mode==='login'&&isPassword));
 label('auth-submit',isPassword?(mode==='signup'?'Create account':'Log in'):(isPhone?'Send mobile OTP':'Send email OTP'));
 hide('otp-panel');
}
function setMode(next){
 mode=next;el('tab-login').classList.toggle('active',mode==='login');el('tab-signup').classList.toggle('active',mode==='signup');
 hide('name-field',mode!=='signup');setMethod(authMethod);
}
function parsePending(){const params=new URLSearchParams(location.search);const candidate=params.get('plan');return PAID_PLAN_IDS.includes(candidate)?candidate:'';}
async function render(){
 const session=await getSession();
 hide('account-loading');hide('auth-panel',Boolean(session)||Boolean(otpContext));hide('otp-panel',Boolean(session)||!otpContext);hide('dashboard',!session);
 if(el('account-heading-title'))el('account-heading-title').innerHTML=session?'Your <span>account.</span>':'Welcome <span>back.</span>';
 if(el('account-heading-subtitle'))el('account-heading-subtitle').textContent=session?'Manage your membership, payment history and account. All eight free tools are available from the homepage.':'Sign up or log in with email OTP, mobile OTP, password, Google or GitHub. Free tools never require an account.';
 if(!session)return;
 const user=session.user;
 label('profile-name',user.user_metadata?.full_name||user.user_metadata?.name||user.email||user.phone||'My account');
 label('profile-email',user.email||user.phone||'');
 const active=config.paymentsEnabled
  ? await apiRequest('/api/me',session.access_token).catch(e=>{notice('Could not load membership information: '+e.message,true);return null;})
  : null;
 if(!config.paymentsEnabled){
  label('plan-name','Free');label('plan-expires','Free tools remain available');
  const list=el('payment-history');list.replaceChildren();
  const p=document.createElement('p');p.textContent='Payments are not active yet. No transactions to show.';list.append(p);
 }
 if(active){
  label('plan-name',PLANS[active.plan]?.label||'Free');
  label('plan-expires',active.expiresAt?new Date(active.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Free tools remain available');
  const list=el('payment-history');list.replaceChildren();
  if(!active.history?.length){const p=document.createElement('p');p.textContent='No payments yet.';list.append(p);}
  else for(const entry of active.history){
   const row=document.createElement('div');row.className='history-row';
   const a=document.createElement('strong');a.textContent=`${PLANS[entry.plan]?.label||'Plan'} · ₹${(entry.amount_paise/100).toFixed(2)}`;
   const b=document.createElement('span');b.textContent=entry.paid_at?new Date(entry.paid_at).toLocaleDateString('en-IN'):'Paid';
   row.append(a,b);list.append(row);
  }
 }
 hide('pending-plan-box',!pending);
 if(pending){label('pending-plan-text',`Selected: ${PLANS[pending].label} · ₹${PLANS[pending].price} for 30 days, one-time payment.`);}
 hide('payments-unavailable',config.paymentsEnabled);
 el('checkout-btn').disabled=!config.paymentsEnabled||buying;
 if(location.hash==='#payment-history')requestAnimationFrame(()=>el('payment-history-title')?.scrollIntoView({block:'start'}));
}
function showReset(){hide('auth-panel');hide('dashboard');hide('password-recovery',false);hide('account-loading');}
function requirePassword(password){if(!password||password.length<10||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))throw new Error('Use at least 10 characters including letters and numbers.');}
async function requestOtp(){
 const isPhone=authMethod==='phone-otp';
 const value=isPhone?normalizeOtpPhone(el('auth-phone').value):normalizeOtpEmail(el('auth-email').value);
 const full_name=el('auth-name').value.trim().slice(0,80);
 const options={shouldCreateUser:mode==='signup',data:mode==='signup'&&full_name?{full_name}:{}};
 const request=isPhone?{phone:value,options:{...options,channel:'sms'}}:{email:value,options:{...options,emailRedirectTo:redirectUrl()}};
 const {error}=await client.auth.signInWithOtp(request);if(error)throw error;
 otpContext={kind:isPhone?'phone':'email',value,mode,sentAt:Date.now()};
 label('otp-target',maskOtpDestination(otpContext.kind,value));
 el('otp-code').value='';hide('auth-panel');hide('otp-panel',false);
 notice(isPhone?'SMS OTP requested. Check your phone.':'Email OTP requested. Check your inbox and spam folder.');
 el('otp-code').focus();
}
async function verifyOtp(event){
 event.preventDefault();notice('');
 if(!otpContext){notice('Request a new OTP first.',true);return;}
 const button=el('otp-verify-btn');button.disabled=true;
 try{
  const token=normalizeOtpCode(el('otp-code').value);
  const input=otpContext.kind==='phone'?{phone:otpContext.value,token,type:'sms'}:{email:otpContext.value,token,type:'email'};
  const {data,error}=await client.auth.verifyOtp(input);if(error)throw error;
  if(!data?.session)throw new Error('OTP was not verified. Please try again.');
  otpContext=null;window.location.assign('/');return;
 }catch(e){notice(e.message||'Could not verify the OTP.',true);}
 finally{button.disabled=false;}
}
async function resendOtp(){
 if(!otpContext)return;
 const seconds=Math.ceil((60000-(Date.now()-otpContext.sentAt))/1000);
 if(seconds>0){notice(`Wait ${seconds} seconds before requesting another OTP.`,true);return;}
 try{
  const {kind,value,mode:otpMode}=otpContext;
  const request=kind==='phone'?{phone:value,options:{channel:'sms',shouldCreateUser:otpMode==='signup'}}:{email:value,options:{emailRedirectTo:redirectUrl(),shouldCreateUser:otpMode==='signup'}};
  const {error}=await client.auth.signInWithOtp(request);if(error)throw error;
  otpContext.sentAt=Date.now();notice('New OTP requested. Use the latest code.');
 }catch(e){notice(e.message||'Could not resend OTP.',true);}
}
async function authAction(event){
 event.preventDefault();notice('');
 const button=el('auth-submit');button.disabled=true;
 try{
  if(authMethod!=='password'){await requestOtp();return;}
  const email=normalizeOtpEmail(el('auth-email').value),password=el('auth-password').value;
  if(mode==='signup'){
   requirePassword(password);
   const full_name=el('auth-name').value.trim().slice(0,80);
   const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:redirectUrl(),data:{full_name}}});
   if(error)throw error;
   if(!data.session)notice('Check your verification email before logging in.');
   else{window.location.assign('/');return;}
  }else{
   const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
   window.location.assign('/');return;
  }
 }catch(e){notice(e.message||'Authentication failed',true);}
 finally{button.disabled=false;}
}
async function social(provider){
 notice('');
 try{sessionStorage.setItem('cx_login_return_home','1');const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:redirectUrl()}});if(error)throw error;}
 catch(e){sessionStorage.removeItem('cx_login_return_home');notice(e.message||'Social login could not start',true);}
}
async function forgot(){
 const email=el('auth-email').value.trim();if(!email){notice('Enter your email address first.',true);return;}
 try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${redirectUrl()}?reset=1`});if(error)throw error;notice('If the address exists, a password reset email has been sent.');}
 catch(e){notice(e.message,true);}
}
async function reset(event){
 event.preventDefault();
 const password=el('reset-password').value;
 try{requirePassword(password);const {error}=await client.auth.updateUser({password});if(error)throw error;history.replaceState({},'',location.pathname);hide('password-recovery');notice('Password updated successfully.');await render();}
 catch(e){notice(e.message,true);}
}
function loadCheckout(){
 return new Promise((resolve,reject)=>{
  if(window.Razorpay)return resolve();
  const js=document.createElement('script');js.src='https://checkout.razorpay.com/v1/checkout.js';js.async=true;
  js.onload=()=>window.Razorpay?resolve():reject(new Error('Payment checkout unavailable'));
  js.onerror=()=>reject(new Error('Cannot load Razorpay checkout'));document.head.append(js);
 });
}
async function purchase(){
 if(buying||!pending)return;
 if(!config.paymentsEnabled){notice('Payments are not activated yet. No charge has been made.',true);return;}
 buying=true;let modalOpened=false;el('checkout-btn').disabled=true;notice('');
 try{
  const session=await getSession();if(!session)throw new Error('Sign in again to continue');
  const created=await apiRequest('/api/create-order',session.access_token,{method:'POST',body:{plan:pending}});
  await loadCheckout();
  const checkout=new window.Razorpay({
   key:created.keyId,amount:created.amount,currency:'INR',order_id:created.orderId,
   name:'CrakkerXworld.AI',description:`${PLANS[pending].label} plan · 30-day pass`,
   prefill:{email:session.user.email||'',contact:session.user.phone||''},theme:{color:'#264332'},
   modal:{ondismiss:()=>{buying=false;el('checkout-btn').disabled=!config.paymentsEnabled;}},
   handler:async (payment)=>{
    try{
     const refreshed=await getSession();if(!refreshed)throw new Error('Session expired');
     await apiRequest('/api/verify-payment',refreshed.access_token,{method:'POST',body:payment});
     pending='';history.replaceState({},'',location.pathname);notice('Payment verified. Your 30-day membership is now active.');await render();
    }catch(e){notice('Payment response received, but access could not be confirmed. Do not pay again. Contact support with your payment receipt.',true);}
    finally{buying=false;el('checkout-btn').disabled=!config.paymentsEnabled;}
   }
  });
  checkout.on('payment.failed',()=>notice('Payment failed. No membership was activated.',true));
  checkout.open();modalOpened=true;
 }catch(e){notice(e.message||'Unable to start checkout',true);}
 finally{if(!modalOpened){buying=false;el('checkout-btn').disabled=!config.paymentsEnabled;}}
}
export async function initAccount(){
 pending=parsePending();
 el('tab-login').addEventListener('click',()=>setMode('login'));
 el('tab-signup').addEventListener('click',()=>setMode('signup'));
 el('auth-form').addEventListener('submit',authAction);
 for(const method of ['email-otp','phone-otp','password'])el('method-'+method).addEventListener('click',()=>{notice('');setMethod(method);});
 el('otp-form').addEventListener('submit',verifyOtp);
 el('otp-resend').addEventListener('click',resendOtp);
 el('otp-change').addEventListener('click',()=>{otpContext=null;hide('otp-panel');hide('auth-panel',false);notice('');});
 el('google-login').addEventListener('click',()=>social('google'));
 el('github-login').addEventListener('click',()=>social('github'));
 el('forgot-password').addEventListener('click',forgot);
 el('reset-form').addEventListener('submit',reset);
 el('logout').addEventListener('click',async()=>{await client.auth.signOut();otpContext=null;notice('Signed out.');await render();});
 el('checkout-btn').addEventListener('click',purchase);
 setMode('login');
 try{
  config=await appConfig();
  if(!config.authEnabled){
   hide('account-loading');hide('auth-panel',false);
   for(const id of ['auth-submit','google-login','github-login','forgot-password']){const node=el(id);if(node)node.disabled=true;}
   notice('Login and signup are not connected yet. Configure Supabase to enable real accounts. No OTP has been sent.',true);
   return;
  }
  client=await supabaseClient();
  client.auth.onAuthStateChange((event)=>{
   if(event==='PASSWORD_RECOVERY'){showReset();return;}
   if(event==='SIGNED_IN'||event==='SIGNED_OUT')queueMicrotask(()=>{
    if(event==='SIGNED_IN'&&!pending&&sessionStorage.getItem('cx_login_return_home')==='1'){
      sessionStorage.removeItem('cx_login_return_home');window.location.replace('/');return;
    }
    render().catch(e=>notice(e.message,true));
   });
  });
  const recovery=new URLSearchParams(location.search).has('reset');
  if(recovery && await getSession())showReset();else await render();
  if(!recovery&&!pending&&sessionStorage.getItem('cx_login_return_home')==='1'&&await getSession()){
   sessionStorage.removeItem('cx_login_return_home');window.location.replace('/');return;
  }
 }catch(e){hide('account-loading');notice('Account setup error. '+e.message,true);}
}
