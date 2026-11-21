export function explainOAuthError(provider, error) {
  const name = provider === 'github' ? 'GitHub' : 'Google';
  const raw = String(error?.message || error || '');
  if (/unsupported provider|provider is not enabled/i.test(raw)) {
    return `${name} sign-in is disabled in Supabase. In Authentication → Sign In / Providers, enable ${name} and add the OAuth Client ID and Client Secret from its developer console.`;
  }
  if (/redirect.*not allowed|redirect_uri|redirect url/i.test(raw)) {
    return 'OAuth redirect is not allowed. Add https://www.crakkerxai.com/account/ to Supabase Authentication → URL Configuration and register the Supabase callback URL in the Google/GitHub developer console.';
  }
  if (/invalid client|client_secret|client_id/i.test(raw)) {
    return `${name} OAuth credentials were rejected. Check the Client ID and Client Secret saved in Supabase Authentication → Sign In / Providers.`;
  }
  return raw || `${name} sign-in could not start. Check the Supabase provider configuration and try again.`;
}
