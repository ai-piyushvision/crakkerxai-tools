import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeOtpEmail,normalizeOtpPhone,normalizeOtpCode,maskOtpDestination} from '../src/otp-utils.mjs';
test('email OTP input normalization',()=>{assert.equal(normalizeOtpEmail('  Hello@Example.COM '),'hello@example.com');assert.throws(()=>normalizeOtpEmail('invalid'))});
test('Indian mobile OTP normalizes to E.164',()=>{assert.equal(normalizeOtpPhone('98765 43210'),'+919876543210');assert.equal(normalizeOtpPhone('+91 (98765) 43210'),'+919876543210');assert.equal(normalizeOtpPhone('919876543210'),'+919876543210')});
test('International E.164 supported',()=>{assert.equal(normalizeOtpPhone('+447700900123'),'+447700900123');assert.throws(()=>normalizeOtpPhone('12345'))});
test('OTP must be 6–8 numeric digits',()=>{assert.equal(normalizeOtpCode(' 123 456 '),'123456');assert.equal(normalizeOtpCode('12345678'),'12345678');assert.throws(()=>normalizeOtpCode('12a456'));assert.throws(()=>normalizeOtpCode('12345'))});
test('Masked OTP destinations hide most of the data',()=>{assert.match(maskOtpDestination('phone','+919876543210'),/3210$/);assert.match(maskOtpDestination('email','test@example.com'),/@example.com$/)});
