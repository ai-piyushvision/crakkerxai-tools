import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.js';

test('feedback endpoint refuses writes when server-side Supabase is not configured', async()=>{
  const response=await worker.fetch(new Request('https://site.example/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),{});
  assert.equal(response.status,503);
});

test('feedback endpoint validates required contact and consent fields', async()=>{
  const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'};
  const response=await worker.fetch(new Request('https://site.example/api/feedback',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({name:'A',email:'bad',phone:'123',category:'bug',subject:'Issue',message:'Long enough message',consent:true})}),env);
  assert.equal(response.status,400);
});

test('feedback endpoint stores valid submissions through the server-only database key', async()=>{
  const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes('select=id'))return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify([{id:'feedback-test-id'}]),{status:201,headers:{'Content-Type':'application/json'}});
  };
  try{
    const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'};
    const payload={name:'Test User',email:'test@example.com',phone:'+91 9876543210',whatsapp:'+91 9876543210',category:'bug',subject:'PDF export issue',message:'The PDF page export does not work as expected.',page_url:'https://site.example/tools/pdf-to-png/',consent:true,company_website:''};
    const response=await worker.fetch(new Request('https://site.example/api/feedback',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json','CF-Connecting-IP':'203.0.113.4'},body:JSON.stringify(payload)}),env);
    assert.equal(response.status,201);
    assert.equal((await response.json()).reference,'feedback-test-id');
    assert.equal(calls.length,2);
    assert.ok(calls.every(call=>call.options.headers.Authorization==='Bearer service'));
  }finally{globalThis.fetch=originalFetch}
});
