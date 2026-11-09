/** Shared account menu. Works on the homepage, all eight tools and account/pricing pages. */
import {appConfig, supabaseClient, getSession, apiRequest} from './auth-client.js';

const find=(name)=>document.querySelector(`[data-${name}]`);
const setText=(name,value)=>{const node=find(name);if(node)node.textContent=value;};
const show=(name,visible)=>find(name)?.classList.toggle('hidden',!visible);

function firstName(user){
 const name=String(user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||user?.phone||'My account');
 return name.trim().split(/\s+/)[0].slice(0,30);
}
function fullName(user){
 return String(user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email||user?.phone||'My account').slice(0,90);
}
function setAvatar(user){
 const node=find('profile-avatar');if(!node)return;
 node.replaceChildren();
 const displayName=fullName(user);
 const initials=displayName.split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('')||'U';
 const url=user?.user_metadata?.avatar_url||user?.user_metadata?.picture;
 if(typeof url==='string'){
  try{
   const parsed=new URL(url);
   if(parsed.protocol==='https:'){
    const img=document.createElement('img');img.src=parsed.href;img.alt='';img.referrerPolicy='no-referrer';img.loading='lazy';
    img.addEventListener('error',()=>{node.textContent=initials;});
    node.append(img);return;
   }
  }catch{} // Fallback to initials when there is no trustworthy photo URL.
 }
 node.textContent=initials;
}
export async function initAccountMenu(){
 const root=find('account-nav');if(!root)return;
 const trigger=find('profile-trigger');
 const popover=find('profile-popover');
 const notices=find('notification-toggle');
 const setOpen=(open)=>{
   show('profile-popover',open);
   trigger?.setAttribute('aria-expanded',String(open));
   if(!open){show('notification-box',false);notices?.setAttribute('aria-expanded','false');}
 };
 trigger?.addEventListener('click',()=>setOpen(popover.classList.contains('hidden')));
 document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))setOpen(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen(false);trigger?.focus();}});
 notices?.addEventListener('click',()=>{
   const open=find('notification-box').classList.contains('hidden');
   show('notification-box',open);notices.setAttribute('aria-expanded',String(open));
 });
 const applySession=async(session)=>{
   const active=Boolean(session?.user);
   show('login-link',!active);show('account-menu',active);
   if(!active){setOpen(false);return;}
   const user=session.user;
   setAvatar(user);
   setText('profile-name',firstName(user));
   setText('profile-fullname',fullName(user));
   setText('profile-email',user.email||user.phone||'');
   setText('profile-plan','Free plan');
   // Plan is sourced from the authenticated server, never from local storage.
   if(session.access_token){
     const result=await apiRequest('/api/me',session.access_token).catch(()=>null);
     if(result&&result.plan){
       const labels={free:'Free',normal:'Normal',plus:'Plus',pro:'Pro',ultra:'Ultra'};
       setText('profile-plan',`${labels[result.plan]||'Free'} plan`);
     }
   }
 };
 find('profile-signout')?.addEventListener('click',async()=>{
   const signout=find('profile-signout');
   signout.disabled=true;
   try{
     const client=await supabaseClient();
     const {error}=await client.auth.signOut();if(error)throw error;
     window.location.assign('/');
   }catch(error){signout.disabled=false;window.alert(error.message||'Unable to sign out. Try again.');}
 });
 try{
   const config=await appConfig();if(!config.authEnabled)return;
   const client=await supabaseClient();
   await applySession(await getSession());
   client.auth.onAuthStateChange((_event,session)=>{
     // Do not call Supabase's async auth methods synchronously inside its callback.
     queueMicrotask(()=>{void applySession(session);});
   });
 }catch(error){console.warn('Account menu unavailable:',error);}
}
