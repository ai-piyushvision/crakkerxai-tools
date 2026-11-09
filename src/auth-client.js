/** Browser Auth: Supabase public key only. Never store service-role or Razorpay secrets here. */
let configPromise,clientPromise;
export async function appConfig(){
 configPromise ||= (async()=>{
  try{
   const r=await fetch('/api/config',{cache:'no-store'});
   if(r.ok && r.headers.get('content-type')?.includes('application/json'))return r.json();
  }catch{/* local Vite preview has no backend */}
  const url=import.meta.env.VITE_SUPABASE_URL||'';
  const key=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
  return {authEnabled:Boolean(url&&key),paymentsEnabled:false,supabaseUrl:url,supabaseAnonKey:key,razorpayKeyId:''};
 })();
 return configPromise;
}
export async function supabaseClient(){
 clientPromise ||= (async()=>{
  const cfg=await appConfig();if(!cfg.authEnabled)return null;
  const {createClient}=await import('@supabase/supabase-js');
  return createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 })();
 return clientPromise;
}
export async function getSession(){
 const client=await supabaseClient();if(!client)return null;
 const {data,error}=await client.auth.getSession();if(error)throw error;return data.session;
}
export async function apiRequest(path,token,options={}){
 const response=await fetch(path,{
  method:options.method||'GET',cache:'no-store',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(options.body?{'Content-Type':'application/json'}:{})},
  body:options.body?JSON.stringify(options.body):undefined
 });
 const result=await response.json().catch(()=>({error:'Server response was not valid JSON'}));
 if(!response.ok)throw new Error(result.error||'Request failed');
 return result;
}
