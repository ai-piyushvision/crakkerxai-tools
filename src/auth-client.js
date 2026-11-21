/** Browser auth client.
 * Only the Supabase URL and publishable/anon key belong in the browser.
 * Never expose the Supabase service-role key or payment secrets here.
 */
const PUBLIC_SUPABASE_URL = 'https://knhduwfwngrffnlxbnwt.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_sIQ_gPy9T64vg0M0L_Ff1w_c4NhturO';

let configPromise;
let clientPromise;

function localPublicConfig() {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL).trim();
  const supabaseAnonKey = String(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    PUBLIC_SUPABASE_KEY
  ).trim();
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl);
  const validKey = supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('eyJ');
  return {
    authEnabled: validUrl && validKey,
    paymentsEnabled: false,
    serverDatabaseEnabled: false,
    passwordPolicyReady: false,
    supabaseUrl: validUrl ? supabaseUrl : '',
    supabaseAnonKey: validKey ? supabaseAnonKey : '',
    razorpayKeyId: '',
    msg91Enabled: false,
    msg91WidgetId: '',
    msg91WidgetToken: ''
  };
}

function mergePublicAuth(remoteConfig, localConfig) {
  const remote = remoteConfig && typeof remoteConfig === 'object' ? remoteConfig : {};
  const remoteReady = Boolean(remote.authEnabled && remote.supabaseUrl && remote.supabaseAnonKey);
  if (remoteReady) return { ...localConfig, ...remote, authEnabled: true };

  // In development, and in static builds that include the public project config,
  // a disabled /api/config must not override valid browser-safe Supabase config.
  if (localConfig.authEnabled) {
    return {
      ...remote,
      ...localConfig,
      paymentsEnabled: Boolean(remote.paymentsEnabled),
      serverDatabaseEnabled: Boolean(remote.serverDatabaseEnabled),
      razorpayKeyId: remote.razorpayKeyId || '',
      msg91Enabled: Boolean(remote.msg91Enabled),
      msg91WidgetId: remote.msg91WidgetId || '',
      msg91WidgetToken: remote.msg91WidgetToken || ''
    };
  }
  return { ...localConfig, ...remote, authEnabled: false };
}

export async function appConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      const localConfig = localPublicConfig();

      // Local Vite development should not wait for a Cloudflare Worker API
      // route that is not hosted by `vite --host`.
      if (import.meta.env.DEV && localConfig.authEnabled) return localConfig;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        let response;
        try {
          response = await fetch('/api/config', {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const remoteConfig = await response.json();
          return mergePublicAuth(remoteConfig, localConfig);
        }
      } catch (error) {
        // A local browser-only Vite server does not host the Cloudflare Worker.
        console.info('Using browser-safe Supabase configuration fallback:', error?.name || 'network unavailable');
      }
      return localConfig;
    })();
  }
  return configPromise;
}

export async function supabaseClient() {
  clientPromise ||= (async () => {
    const cfg = await appConfig();
    if (!cfg.authEnabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
  })();
  return clientPromise;
}

export async function getSession() {
  const client = await supabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function apiRequest(path, token, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    cache: 'no-store',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const result = await response.json().catch(() => ({ error: 'Server response was not valid JSON' }));
  if (!response.ok) {
    const context = [result.code, result.stage && `stage: ${result.stage}`, result.requestId && `reference: ${result.requestId}`]
      .filter(Boolean).join(' · ');
    throw new Error(`${result.error || 'Request failed'}${context ? ` (${context})` : ''}`);
  }
  return result;
}
