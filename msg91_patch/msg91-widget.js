/** MSG91 browser widget adapter. The widget token is a browser-scoped credential, NEVER the Authkey. */
let initialized;
const API_SCRIPT = 'https://verify.msg91.com/otp-provider.js';
function checkResult(value) {
  if (value?.type === 'error' || value?.hasError || value?.status === 'fail') {
    throw new Error(typeof value?.message === 'string' ? value.message : 'MSG91 request failed');
  }
  return value;
}
export async function initMsg91(config) {
  if (!config?.msg91Enabled || !config.msg91WidgetId || !config.msg91WidgetToken) {
    throw new Error('Mobile OTP is not configured. Enable MSG91 Widget in Cloudflare settings.');
  }
  initialized ||= (async () => {
    if (!window.initSendOTP) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = API_SCRIPT;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('MSG91 OTP service could not be loaded'));
        document.head.append(script);
      });
    }
    if (typeof window.initSendOTP !== 'function') throw new Error('MSG91 SDK could not initialize');
    await window.initSendOTP({
      widgetId: config.msg91WidgetId,
      tokenAuth: config.msg91WidgetToken,
      exposeMethods: true,
      captchaRenderId: 'msg91-captcha',
      success() {}, failure() {}
    });
    for (let i=0; i<40 && typeof window.sendOtp !== 'function'; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (typeof window.sendOtp !== 'function' || typeof window.verifyOtp !== 'function') {
      throw new Error('MSG91 did not provide its OTP methods');
    }
  })().catch(error => { initialized = undefined; throw error; });
  return initialized;
}
function callWidget(method, args) {
  return new Promise((resolve, reject) => {
    const onSuccess = response => { try { resolve(checkResult(response)); } catch (error) { reject(error); } };
    const onError = error => reject(new Error(typeof error === 'string' ? error : error?.message || 'OTP provider request failed'));
    try { window[method](...args, onSuccess, onError); } catch (error) { reject(error); }
  });
}
function requestId(data) {
  const value = data?.reqId || data?.request_id || data?.requestId || data?.message;
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(value) ? value : null;
}
export async function sendMsg91Otp(phone, config) {
  await initMsg91(config);
  const data = await callWidget('sendOtp', [phone.replace(/^\+/, '')]);
  return { reqId: requestId(data) };
}
export async function resendMsg91Otp(channel, reqId) {
  if (typeof window.retryOtp !== 'function') throw new Error('MSG91 retry is not available');
  const code = channel === 'whatsapp' ? '12' : '11';
  const data = await new Promise((resolve, reject) => {
    try {
      window.retryOtp(code, x => { try { resolve(checkResult(x)); } catch(e) {reject(e);} },
        e => reject(new Error(e?.message || 'Unable to resend OTP')), reqId || undefined);
    } catch (error) { reject(error); }
  });
  return { reqId: requestId(data) || reqId || null };
}
export async function verifyMsg91Otp(otp, reqId) {
  if (typeof window.verifyOtp !== 'function') throw new Error('MSG91 verification is unavailable');
  const result = await new Promise((resolve, reject) => {
    try {
      window.verifyOtp(otp, x => {try {resolve(checkResult(x));} catch(e){reject(e);}},
        e => reject(new Error(e?.message || 'Invalid OTP')), reqId || undefined);
    } catch (error) {reject(error);}
  });
  const token = result?.['access-token'] || result?.accessToken || result?.access_token || result?.message || result?.token || (typeof result === 'string' ? result : '');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('OTP validated, but MSG91 did not return an access token. Check widget configuration.');
  }
  return token;
}
