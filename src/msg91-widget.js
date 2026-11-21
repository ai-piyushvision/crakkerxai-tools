/** MSG91 browser widget adapter. Browser tokens are widget-scoped credentials, never Authkeys. */
let activeWidgetKey = null;
let initializationPromise = null;
let initializationKey = null;
const API_SCRIPT = 'https://verify.msg91.com/otp-provider.js';

function messageFromProvider(value) {
  const raw = typeof value === 'string' ? value : value?.message || value?.error || value?.code || value?.type || '';
  const message = typeof raw === 'string' ? raw : String(raw?.message || raw?.code || '');
  if (/invalid\s*captcha\s*token|captcha.*invalid|invalid.*captcha/i.test(message)) {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://crakkerxai.com';
    return `MSG91 CAPTCHA verification failed for ${origin}. The CAPTCHA was rejected before OTP generation, so no OTP delivery/log entry is expected. Confirm the MSG91 widget CAPTCHA is enabled for this exact website domain, and that the CAPTCHA mount is available on the account page.`;
  }
  if (/AuthenticationFailure|authentication failed|unauthori[sz]ed|invalid.?widget|invalid.?token/i.test(message)) {
    return 'MSG91 rejected the selected OTP widget. Pair the selected channel exact widget ID with the existing CrakkerXOTP token (MSG91_WIDGET_TOKEN) or its channel-specific token override. Keep MSG91_AUTHKEY in the same MSG91 account and allow both crakkerxai.com and www.crakkerxai.com in the widget/CAPTCHA domain settings.';
  }
  return message || 'MSG91 OTP request failed. Verify the selected channel widget and try again.';
}
function checkResult(value) {
  const raw = typeof value === 'string' ? value : value?.message || value?.error || value?.code || value?.type || '';
  const rawText = typeof raw === 'string' ? raw : String(raw?.message || raw?.code || '');
  if (value?.type === 'error' || value?.hasError || value?.status === 'fail' ||
      /invalid\s*captcha\s*token|captcha.*invalid|invalid.*captcha|AuthenticationFailure|authentication failed|unauthori[sz]ed|invalid.?widget|invalid.?token/i.test(rawText)) {
    throw new Error(messageFromProvider(value));
  }
  return value;
}
function credentialsFor(config, channel) {
  if (channel === 'whatsapp') {
    if (!config?.msg91WhatsappEnabled || !config.msg91WhatsappWidgetId || !config.msg91WhatsappWidgetToken) {
      throw new Error('WhatsApp OTP is not connected yet. Configure MSG91_WHATSAPP_WIDGET_ID and MSG91_WHATSAPP_WIDGET_TOKEN for a WhatsApp-primary widget. SMS remains available.');
    }
    return { id: config.msg91WhatsappWidgetId, token: config.msg91WhatsappWidgetToken };
  }
  const id = config?.msg91SmsWidgetId || config?.msg91WidgetId;
  const token = config?.msg91SmsWidgetToken || config?.msg91WidgetToken;
  if (!config?.msg91Enabled || !id || !token) {
    throw new Error('SMS OTP is not configured. Set MSG91_AUTHKEY, SUPABASE_SERVICE_ROLE_KEY, MSG91_SMS_WIDGET_ID and MSG91_SMS_WIDGET_TOKEN in the crakkerxai-tools Worker.');
  }
  return { id, token };
}
function ensureCaptchaMount() {
  if (typeof document === 'undefined') return null;
  let mount = document.getElementById('msg91-captcha');
  if (mount) return mount;
  mount = document.createElement('div');
  mount.id = 'msg91-captcha';
  mount.className = 'msg91-captcha-mount';
  mount.setAttribute('aria-label', 'MSG91 security verification');
  const form = document.getElementById('auth-form');
  const submit = form?.querySelector('#auth-submit');
  if (form && submit) form.insertBefore(mount, submit);
  else if (form) form.append(mount);
  else document.body?.append(mount);
  return mount;
}

async function loadSdk() {
  if (typeof window.initSendOTP === 'function') return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = API_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('MSG91 OTP service could not be loaded'));
    document.head.append(script);
  });
  if (typeof window.initSendOTP !== 'function') throw new Error('MSG91 SDK could not initialize');
}
export async function initMsg91(config, channel = 'sms') {
  const selected = credentialsFor(config, channel);
  const widgetKey = `${channel}:${selected.id}:${selected.token}`;
  if (activeWidgetKey === widgetKey && typeof window.sendOtp === 'function' && typeof window.verifyOtp === 'function') return;
  if (initializationPromise && initializationKey === widgetKey) return initializationPromise;

  initializationKey = widgetKey;
  initializationPromise = (async () => {
    await loadSdk();
    const captchaMount = ensureCaptchaMount();
    if (typeof document !== 'undefined' && !captchaMount) {
      throw new Error('MSG91 CAPTCHA could not initialize because the #msg91-captcha mount is missing. Reload the account page and try again.');
    }
    // A channel switch uses a different MSG91 widget. Clear any stale challenge
    // markup before the SDK renders the selected widget CAPTCHA into this mount.
    if (captchaMount) captchaMount.replaceChildren();
    let initFailure = null;
    const initResult = window.initSendOTP({
      widgetId: selected.id,
      tokenAuth: selected.token,
      exposeMethods: true,
      captchaRenderId: 'msg91-captcha',
      success() {},
      failure(error) { initFailure = new Error(messageFromProvider(error)); }
    });
    if (initResult && typeof initResult.then === 'function') await initResult;
    for (let i = 0; i < 40 && typeof window.sendOtp !== 'function'; i++) {
      if (initFailure) throw initFailure;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (initFailure) throw initFailure;
    if (typeof window.sendOtp !== 'function' || typeof window.verifyOtp !== 'function') {
      throw new Error('MSG91 did not provide its OTP methods. Verify the selected widget ID and browser token.');
    }
    activeWidgetKey = widgetKey;
  })().catch(error => {
    activeWidgetKey = null;
    throw error;
  }).finally(() => {
    if (initializationKey === widgetKey) {
      initializationPromise = null;
      initializationKey = null;
    }
  });
  return initializationPromise;
}
function callWidget(method, args) {
  return new Promise((resolve, reject) => {
    const onSuccess = response => { try { resolve(checkResult(response)); } catch (error) { reject(error); } };
    const onError = error => reject(new Error(messageFromProvider(error)));
    try { window[method](...args, onSuccess, onError); } catch (error) { reject(error); }
  });
}
function requestId(data) {
  const value = data?.reqId || data?.request_id || data?.requestId || data?.message;
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(value) ? value : null;
}
export async function sendMsg91Otp(phone, config, channel = 'sms') {
  await initMsg91(config, channel);
  const data = await callWidget('sendOtp', [phone.replace(/^\+/, '')]);
  return { reqId: requestId(data), channel };
}
export async function resendMsg91Otp(channel, reqId) {
  if (typeof window.retryOtp !== 'function') throw new Error('MSG91 retry is not available');
  const code = channel === 'whatsapp' ? '12' : '11';
  const data = await new Promise((resolve, reject) => {
    try {
      window.retryOtp(code, x => { try { resolve(checkResult(x)); } catch (error) { reject(error); } },
        error => reject(new Error(messageFromProvider(error))), reqId || undefined);
    } catch (error) { reject(error); }
  });
  return { reqId: requestId(data) || reqId || null };
}
export async function verifyMsg91Otp(otp, reqId) {
  if (typeof window.verifyOtp !== 'function') throw new Error('MSG91 verification is unavailable');
  const result = await new Promise((resolve, reject) => {
    try {
      window.verifyOtp(otp, x => { try { resolve(checkResult(x)); } catch (error) { reject(error); } },
        error => reject(new Error(messageFromProvider(error))), reqId || undefined);
    } catch (error) { reject(error); }
  });
  const token = result?.['access-token'] || result?.accessToken || result?.access_token || result?.message || result?.token || (typeof result === 'string' ? result : '');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('OTP validated, but MSG91 did not return an access token. Check the selected widget configuration.');
  }
  return token;
}
