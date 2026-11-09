/** Pure validators so OTP flows can be tested without an SMS provider. */
export function normalizeOtpEmail(value){
 const email=String(value||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
 return email;
}
export function normalizeOtpPhone(value){
 let phone=String(value||'').trim().replace(/[\s()-]/g,'');
 // India-focused UX: +91 is assumed only for an ordinary 10-digit Indian mobile.
 if(/^[6-9]\d{9}$/.test(phone))phone='+91'+phone;
 else if(/^91[6-9]\d{9}$/.test(phone))phone='+'+phone;
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error('Enter a valid mobile number, e.g. +91 9876543210.');
 return phone;
}
export function normalizeOtpCode(value){
 const code=String(value||'').trim().replace(/\s/g,'');
 if(!/^\d{6,8}$/.test(code))throw new Error('Enter the 6–8 digit OTP exactly as received.');
 return code;
}
export function maskOtpDestination(kind,value){
 if(kind==='phone')return value.slice(0,Math.max(2,value.length-4)).replace(/\d(?=\d{2})/g,'•')+value.slice(-4);
 const [a,b]=value.split('@');return `${a.slice(0,2)}${'•'.repeat(Math.max(2,a.length-2))}@${b}`;
}
