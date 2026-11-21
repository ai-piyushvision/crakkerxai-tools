/** Convert the caller's RLS-protected Supabase row into the enforced policy. */
export function normalizePasswordPolicyRow(row, now=Date.now()){
 if(!row)throw new Error('No password-security record exists for this account. Run supabase/migrations/20261120_account_password_policy.sql in the Supabase project connected to this website.');
 const changedAt=row.password_changed_at||null;
 const parsed=changedAt?Date.parse(changedAt):null;
 if(changedAt&&(!Number.isFinite(parsed)))throw new Error('The password-change timestamp in Supabase is invalid. Please contact support before continuing.');
 const ageMs=parsed===null?null:Math.max(0,now-parsed);
 const ageDays=ageMs===null?null:Math.floor(ageMs/86400000);
 const setupRequired=Boolean(row.password_setup_required);
 return {
  passwordSet:Boolean(changedAt),passwordChangedAt:changedAt,passwordAgeDays:ageDays,
  passwordSetupRequired:setupRequired,passwordSetupReason:row.password_setup_reason||'initial_setup',
  mustSetPassword:setupRequired||!changedAt||ageMs>=60*86400000,passwordMaxAgeDays:60
 };
}


/**
 * Legacy accounts have no trustworthy historical password-change timestamp.
 * A freshly verified email OTP proves control of the account email and is
 * sufficient to establish the first 60-day password baseline without asking
 * for an old password the user may never have set or may no longer know.
 * Once a real timestamp exists, age-based renewals still require the current
 * password unless the user goes through the dedicated recovery flow.
 */
export function requiresCurrentPasswordForSetup(policy,{verifiedEmailOtp=false}={}){
 const aged=Number.isFinite(policy?.passwordAgeDays)&&policy.passwordAgeDays>=60;
 const legacy=policy?.passwordSetupReason==='legacy_rollout';
 const firstBaselinePending=legacy&&!policy?.passwordChangedAt;
 if(firstBaselinePending&&verifiedEmailOtp)return false;
 return Boolean(aged||legacy||policy?.passwordSet);
}
