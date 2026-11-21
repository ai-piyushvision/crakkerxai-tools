"""Apply MSG91 Widget client + Worker bridge to the exact CrakkerXworld.AI repo layout."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
PATCH = Path(__file__).resolve().parent


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise RuntimeError(f'{label}: expected 1 anchor, found {text.count(old)}; repository changed. No file was overwritten.')
    return text.replace(old, new, 1)


def replace_block(text, start, end, new, label):
    a, b = text.find(start), text.find(end)
    if a < 0 or b < 0 or b <= a:
        raise RuntimeError(f'{label}: cannot locate old function markers. No file was overwritten.')
    return text[:a] + new + text[b:]


def stage():
    files = {}
    page = ROOT / 'src/account-page.js'
    worker = ROOT / 'server/worker.js'
    html = ROOT / 'account/index.html'
    for path in (page, worker, html):
        if not path.exists():
            raise RuntimeError(f'Missing {path}; extract into the repository root.')
    a = page.read_text(encoding='utf8')
    w = worker.read_text(encoding='utf8')
    h = html.read_text(encoding='utf8')
    if 'sendMsg91Otp' in a or 'handleMsg91Auth' in w:
        raise RuntimeError('MSG91 patch appears to already be installed; no files changed.')

    a = replace_once(a,
        "import {normalizeOtpEmail,normalizeOtpPhone,normalizeOtpCode,maskOtpDestination} from './otp-utils.mjs';",
        "import {normalizeOtpEmail,normalizeOtpPhone,normalizeOtpCode,maskOtpDestination} from './otp-utils.mjs';\nimport {sendMsg91Otp,resendMsg91Otp,verifyMsg91Otp} from './msg91-widget.js';",
        'client import')
    a = replace_once(a, "hide('otp-panel');\n}", "hide('otp-panel');\n hide('otp-whatsapp');\n}", 'method reset')

    new_request = '''async function requestOtp(){
 const isPhone=authMethod==='phone-otp';
 const value=isPhone?normalizeOtpPhone(el('auth-phone').value):normalizeOtpEmail(el('auth-email').value);
 const full_name=el('auth-name').value.trim().slice(0,80);
 if(isPhone){
  if(!config.msg91Enabled)throw new Error('Mobile OTP is not configured. Please use email OTP for now.');
  const sent=await sendMsg91Otp(value,config);
  otpContext={kind:'msg91',value,mode,full_name,reqId:sent.reqId,sentAt:Date.now()};
  label('otp-target',maskOtpDestination('phone',value));
  el('otp-code').value='';hide('auth-panel');hide('otp-panel',false);hide('otp-whatsapp',false);
  notice('SMS OTP requested. If needed, select Resend via WhatsApp.');
  el('otp-code').focus();return;
 }
 const options={shouldCreateUser:mode==='signup',data:mode==='signup'&&full_name?{full_name}:{}};
 const {error}=await client.auth.signInWithOtp({email:value,options:{...options,emailRedirectTo:redirectUrl()}});
 if(error)throw error;
 otpContext={kind:'email',value,mode,sentAt:Date.now()};
 label('otp-target',maskOtpDestination('email',value));
 el('otp-code').value='';hide('auth-panel');hide('otp-panel',false);hide('otp-whatsapp');
 notice('Email OTP requested. Check your inbox and spam folder.');
 el('otp-code').focus();
}
'''
    a=replace_block(a,'async function requestOtp(){','async function verifyOtp(event){',new_request,'requestOtp')

    new_verify = '''async function verifyOtp(event){
 event.preventDefault();notice('');
 if(!otpContext){notice('Request a new OTP first.',true);return;}
 const button=el('otp-verify-btn');button.disabled=true;
 try{
  const token=normalizeOtpCode(el('otp-code').value);
  let result;
  if(otpContext.kind==='msg91'){
   const accessToken=await verifyMsg91Otp(token,otpContext.reqId);
   const proof=await apiRequest('/api/auth/msg91',null,{method:'POST',body:{accessToken,signup:otpContext.mode==='signup',fullName:otpContext.full_name||''}});
   result=await client.auth.verifyOtp({token_hash:proof.tokenHash,type:'magiclink'});
  }else{
   result=await client.auth.verifyOtp({email:otpContext.value,token,type:'email'});
  }
  if(result.error)throw result.error;
  if(!result.data?.session)throw new Error('OTP was not verified. Please try again.');
  otpContext=null;window.location.assign('/');return;
 }catch(e){notice(e.message||'Could not verify the OTP.',true);}
 finally{button.disabled=false;}
}
'''
    a=replace_block(a,'async function verifyOtp(event){','async function resendOtp(){',new_verify,'verifyOtp')

    new_resend = '''async function resendOtp(channel='sms'){
 if(!otpContext)return;
 const seconds=Math.ceil((60000-(Date.now()-otpContext.sentAt))/1000);
 if(seconds>0){notice(`Wait ${seconds} seconds before requesting another OTP.`,true);return;}
 try{
  if(otpContext.kind==='msg91'){
   const sent=await resendMsg91Otp(channel,otpContext.reqId);
   otpContext.reqId=sent.reqId;otpContext.sentAt=Date.now();
   notice(channel==='whatsapp'?'WhatsApp OTP requested. Check WhatsApp.':'New SMS OTP requested.');return;
  }
  const {value,mode:otpMode}=otpContext;
  const {error}=await client.auth.signInWithOtp({email:value,options:{emailRedirectTo:redirectUrl(),shouldCreateUser:otpMode==='signup'}});
  if(error)throw error;
  otpContext.sentAt=Date.now();notice('New OTP requested. Use the latest code.');
 }catch(e){notice(e.message||'Could not resend OTP.',true);}
}
'''
    a=replace_block(a,'async function resendOtp(){','async function authAction(event){',new_resend,'resendOtp')
    a=replace_once(a,
      "el('otp-resend').addEventListener('click',resendOtp);",
      "el('otp-resend').addEventListener('click',()=>resendOtp('sms'));\n el('otp-whatsapp').addEventListener('click',()=>resendOtp('whatsapp'));",
      'retry handlers')

    h=replace_once(h,
      '<p class="auth-hint">For India, enter a 10-digit mobile number. International numbers need +country code. Standard SMS charges may apply.</p></div>',
      '<p class="auth-hint">For India, enter a 10-digit mobile number. SMS is primary; WhatsApp is available as an OTP resend when MSG91 permits it.</p><div id="msg91-captcha"></div></div>',
      'phone captcha container')
    h=replace_once(h,
      '<button id="otp-resend" class="text-action" type="button">Resend code</button>',
      '<button id="otp-resend" class="text-action" type="button">Resend SMS</button><button id="otp-whatsapp" class="text-action hidden" type="button">Resend via WhatsApp</button>',
      'WhatsApp retry button')

    w=replace_once(w,
      "import {amountPaise, PAID_PLAN_IDS, getPlan} from '../src/plans.mjs';",
      "import {amountPaise, PAID_PLAN_IDS, getPlan} from '../src/plans.mjs';\nimport {phoneAuthConfig,handleMsg91Auth} from './msg91-auth.js';",
      'worker import')
    w=replace_once(w,
      "razorpayKeyId:isPaymentReady(env)?env.RAZORPAY_KEY_ID:''",
      "razorpayKeyId:isPaymentReady(env)?env.RAZORPAY_KEY_ID:'',\n  msg91Enabled:phoneAuthConfig(env).enabled,\n  msg91WidgetId:phoneAuthConfig(env).widgetId,\n  msg91WidgetToken:phoneAuthConfig(env).widgetToken",
      'config response')
    w=replace_once(w,
      "if(path==='/api/razorpay/webhook' && req.method==='POST')return webhook(req,env);",
      "if(path==='/api/razorpay/webhook' && req.method==='POST')return webhook(req,env);\n if(path==='/api/auth/msg91' && req.method==='POST')return handleMsg91Auth(req,env);",
      'auth API route')
    files[page]=a
    files[worker]=w
    files[html]=h
    files[ROOT/'src/msg91-widget.js']=(PATCH/'msg91-widget.js').read_text(encoding='utf8')
    files[ROOT/'server/msg91-auth.js']=(PATCH/'msg91-auth.js').read_text(encoding='utf8')
    files[ROOT/'supabase/migrations/20261110_msg91_phone_auth.sql']=(PATCH/'20261110_msg91_phone_auth.sql').read_text(encoding='utf8')
    return files


def main():
    files=stage()  # Check every anchor before touching anything.
    for path,content in files.items():
        path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists():
            backup=path.with_suffix(path.suffix+'.before-msg91.bak')
            shutil.copyfile(path,backup)
        path.write_text(content,encoding='utf8')
        print('Updated',path.relative_to(ROOT))
    print('Patch applied. Set MSG91_WIDGET_TOKEN Cloudflare secret, run Supabase SQL, then npm test / npm run build.')

if __name__=='__main__':main()
