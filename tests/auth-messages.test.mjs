import test from 'node:test';
import assert from 'node:assert/strict';
import {friendlyAuthMessage} from '../src/auth-messages.mjs';

test('unregistered mobile account gets a short next-step message',()=>{
  assert.equal(
    friendlyAuthMessage('No mobile account is registered for this number. (PHONE_ACCOUNT_NOT_FOUND · stage: lookup_phone_identity · reference: abc123)'),
    'No account found for this mobile number. Create an account or sign in by email.'
  );
});

test('OTP replay and verification errors stay concise',()=>{
  assert.equal(friendlyAuthMessage('otp already verified'), 'This code has already been used. Request a new OTP.');
  assert.equal(friendlyAuthMessage('MSG91_VERIFY_UNREACHABLE stage: verify_msg91_access_token'), 'OTP was verified, but sign-in could not finish. Request a new code.');
});

test('CAPTCHA, password and network errors use short wording',()=>{
  assert.equal(friendlyAuthMessage('Invalid Captcha Token.'), 'Security check failed. Refresh the page and try again.');
  assert.equal(friendlyAuthMessage('The new password and confirmation do not match.'), 'Passwords do not match.');
  assert.equal(friendlyAuthMessage('Failed to fetch'), 'Connection problem. Check your internet and try again.');
});
