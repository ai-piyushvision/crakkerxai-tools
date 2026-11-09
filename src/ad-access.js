/** Load AdSense only for anonymous/free users, after checking active membership. */
import {appConfig,supabaseClient,getSession,apiRequest} from './auth-client.js';
let permittedPromise;
export function adsPermitted(){
 permittedPromise ||= (async()=>{
  if(document.body.classList.contains('account-body'))return false;
  try{
   const config=await appConfig();if(!config.authEnabled)return true;
   const client=await supabaseClient();if(!client)return true;
   const session=await getSession();if(!session)return true;
   const me=await apiRequest('/api/me',session.access_token);
   return me.plan==='free';
  }catch(e){console.warn('Skipping ads until membership is known');return false;}
 })();
 return permittedPromise;
}
export async function initAdvertising(){
 if(!await adsPermitted())return false;
 const script=document.createElement('script');script.async=true;
 script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8574777140654469';
 script.crossOrigin='anonymous';document.head.appendChild(script);
 return true;
}
