import test from 'node:test';
import assert from 'node:assert/strict';
import {explainOAuthError} from '../src/oauth-errors.mjs';

test('disabled Google provider gives exact Supabase setup guidance',()=>{
 const message=explainOAuthError('google',{message:'Unsupported provider: provider is not enabled'});
 assert.match(message,/Google sign-in is disabled in Supabase/);
 assert.match(message,/OAuth Client ID and Client Secret/);
});

test('disabled GitHub provider gives exact Supabase setup guidance',()=>{
 const message=explainOAuthError('github',{message:'Unsupported provider: provider is not enabled'});
 assert.match(message,/GitHub sign-in is disabled in Supabase/);
});

test('OAuth redirect errors point to the correct site redirect and provider callback setup',()=>{
 const message=explainOAuthError('google',{message:'redirect_uri is not allowed'});
 assert.match(message,/https:\/\/www\.crakkerxai\.com\/account\//);
 assert.match(message,/Supabase callback URL/);
});
