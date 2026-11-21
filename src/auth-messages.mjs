const RULES = [
  [/PHONE_ACCOUNT_NOT_FOUND/i, 'No account found for this mobile number. Create an account or sign in by email.'],
  [/PHONE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT|PHONE_ALREADY_LINKED/i, 'This mobile number is linked to another account. Sign in to that account to continue.'],
  [/ACCOUNT_ALREADY_HAS_DIFFERENT_MOBILE/i, 'This account already has a different mobile number linked.'],
  [/VERIFIED_EMAIL_REQUIRED|VERIFIED_EMAIL_MISMATCH|EMAIL_NOT_VERIFIED_FOR_LINK/i, 'Verify the same email address to continue.'],
  [/PHONE_LINK_REQUEST_EXPIRED|MOBILE_LINK_EXPIRED|PHONE_LINK_REQUEST_ALREADY_USED/i, 'This verification expired. Request a new code.'],
  [/IDENTITY_LINK_FAILED|IDENTITY_LINK_UNEXPECTED/i, 'We could not connect these sign-in methods. Please try again.'],
  [/otp already verified|already been verified|code has already been used/i, 'This code has already been used. Request a new OTP.'],
  [/MSG91_VERIFY_UNREACHABLE|Could not reach MSG91|verify_msg91_access_token/i, 'OTP was verified, but sign-in could not finish. Request a new code.'],
  [/Invalid Captcha Token|CAPTCHA verification failed/i, 'Security check failed. Refresh the page and try again.'],
  [/invalid otp|otp.*(expired|incorrect)|token has expired/i, 'That code is incorrect or expired. Request a new OTP.'],
  [/Invalid login credentials|invalid credentials/i, 'Email or password is incorrect.'],
  [/User already registered|already exists/i, 'An account already exists. Please log in instead.'],
  [/Email not confirmed/i, 'Verify your email before signing in.'],
  [/password.*(at least|10 characters)|Use at least 10 characters/i, 'Use 10+ characters with at least one letter and one number.'],
  [/confirmation do not match|passwords? do not match/i, 'Passwords do not match.'],
  [/Failed to fetch|NetworkError|network request failed/i, 'Connection problem. Check your internet and try again.'],
  [/password.?policy|account_password_security|schema cache/i, 'Account security is temporarily unavailable. Please try again later.'],
  [/Unable to complete this request|Authentication failed/i, 'We could not complete sign-in. Please try again.']
];

export function friendlyAuthMessage(error) {
  const raw = String(error?.message || error || '').trim();
  if (!raw) return 'Something went wrong. Please try again.';
  for (const [pattern, message] of RULES) {
    if (pattern.test(raw)) return message;
  }
  // Keep unfamiliar provider errors concise; never display request IDs or stack details.
  const withoutReference = raw
    .replace(/\s*\([^)]*(?:reference|requestId|stage)[:=][^)]*\)/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutReference.length > 150
    ? `${withoutReference.slice(0, 147).trimEnd()}…`
    : withoutReference;
}
