import {PLANS,PAID_PLAN_IDS} from './plans.mjs';
import {normalizePasswordPolicyRow,requiresCurrentPasswordForSetup} from './password-policy.mjs';
import {appConfig,supabaseClient,getSession,apiRequest} from './auth-client.js';
import {normalizeOtpEmail,normalizeOtpPhone,normalizeOtpCode,maskOtpDestination} from './otp-utils.mjs';
import {sendMsg91Otp,resendMsg91Otp,verifyMsg91Otp} from './msg91-widget.js';
import {explainOAuthError} from './oauth-errors.mjs';
import {friendlyAuthMessage} from './auth-messages.mjs';
const el=(id)=>document.getElementById(id);
const hide=(id,hidden=true)=>el(id)?.classList.toggle('hidden',hidden);
const label=(id,value)=>{if(el(id))el(id).textContent=value;};
const redirectUrl=()=>{
 const hostname=String(location.hostname||'').toLowerCase();
 if(hostname==='crakkerxai.com'||hostname==='www.crakkerxai.com')return 'https://www.crakkerxai.com/account/';
 return `${location.origin}/account/`;
};
const profileRedirectUrl=()=>`${redirectUrl()}?view=overview`;
let mode='login';let authMethod='email-otp';let otpContext=null;let client;let config;let pending='';let buying=false;let activeAccountSession=null;let selectedPhoneOtpChannel='whatsapp';let identityLinkContext=null;let selectedIdentityChannel='whatsapp';let selectedIdentityEmailChannel='whatsapp';
let passwordHumanChallenge=null;let passwordHumanState='idle';let passwordHumanTimer=null;let passwordHumanStartedAt=0;let passwordHumanHeldMs=0;let accountPreferences=null;
const EMAIL_OTP_PASSWORD_SETUP_PROOF_KEY='cx_email_otp_password_setup_proof_v1';
function storeEmailOtpPasswordSetupProof(userId){
 try{sessionStorage.setItem(EMAIL_OTP_PASSWORD_SETUP_PROOF_KEY,JSON.stringify({userId,verifiedAt:Date.now()}));}catch{}
}
function hasFreshEmailOtpPasswordSetupProof(userId){
 if(!userId)return false;
 try{
  const proof=JSON.parse(sessionStorage.getItem(EMAIL_OTP_PASSWORD_SETUP_PROOF_KEY)||'null');
  const fresh=proof?.userId===userId&&Number.isFinite(proof.verifiedAt)&&Date.now()-proof.verifiedAt>=0&&Date.now()-proof.verifiedAt<=15*60*1000;
  if(!fresh)sessionStorage.removeItem(EMAIL_OTP_PASSWORD_SETUP_PROOF_KEY);
  return fresh;
 }catch{return false;}
}
function clearEmailOtpPasswordSetupProof(){try{sessionStorage.removeItem(EMAIL_OTP_PASSWORD_SETUP_PROOF_KEY);}catch{}}
function notice(message,problem=false){const node=el('account-notice');const text=problem?friendlyAuthMessage(message):String(message||'');node.textContent=text;node.classList.toggle('hidden',!text);node.classList.toggle('account-error',problem);}
function setMethod(next){
 if(mode==='signup')next='phone-otp';
 authMethod=next;otpContext=null;
 for(const method of ['email-otp','phone-otp','password']){
  const button=el('method-'+method);button.classList.toggle('active',method===authMethod);
  button.setAttribute('aria-pressed',String(method===authMethod));
 }
 const isPhoneOtp=authMethod==='phone-otp';const isPassword=authMethod==='password';
 const passwordUsesPhone=isPassword&&mode==='login'&&el('password-identity-type')?.value==='phone';
 const isSignup=mode==='signup';
 const showPhone=isPhoneOtp||passwordUsesPhone||isSignup;
 const showEmail=isSignup||!showPhone;
 hide('auth-methods',isSignup);
 hide('signup-identity-hint',!isSignup);
 hide('name-field',!isSignup);
 hide('password-login-identity',!(isPassword&&mode==='login'));
 hide('phone-field',!showPhone);hide('email-field',!showEmail);hide('password-field',!isPassword);
 hide('phone-otp-channel-field',!isPhoneOtp);
 hide('password-human-check',!(isPassword&&mode==='login'));
 hide('msg91-captcha',isPassword&&mode==='login');
 if(isPhoneOtp)refreshPhoneOtpChannels();
 if(isPassword&&mode==='login')void loadPasswordHumanChallenge();else resetPasswordHumanCheck();
 el('auth-phone').required=showPhone;el('auth-email').required=showEmail;el('auth-password').required=isPassword;
 el('auth-password').autocomplete=mode==='signup'?'new-password':'current-password';
 el('auth-phone').autocomplete='tel';
 hide('forgot-password',!(mode==='login'&&isPassword&&!passwordUsesPhone));
 label('auth-submit',isSignup?'Send mobile OTP & continue':isPassword?(mode==='signup'?'Create account':'Log in with password'):(isPhoneOtp?'Send mobile OTP':'Send email OTP'));
 hide('otp-panel');hide('otp-whatsapp');
}

function refreshPhoneOtpChannels(){
 const sms=el('otp-channel-sms');
 const whatsapp=el('otp-channel-whatsapp');
 const smsEnabled=Boolean(config?.msg91SmsEnabled??config?.msg91Enabled);
 const whatsappEnabled=Boolean(config?.msg91WhatsappEnabled&&config.msg91WhatsappWidgetId&&config.msg91WhatsappWidgetToken);
 // Keep both channel cards selectable. Missing provider setup is reported on send,
 // not by rendering dead/greyed-out controls that users cannot interact with.
 if(sms)sms.disabled=false;
 if(whatsapp)whatsapp.disabled=false;
 el('otp-channel-sms-card')?.classList.toggle('is-selected',selectedPhoneOtpChannel==='sms');
 el('otp-channel-whatsapp-card')?.classList.toggle('is-selected',selectedPhoneOtpChannel==='whatsapp');
 const hint=el('otp-channel-setup-hint');
 if(hint){
  if(!smsEnabled&&!whatsappEnabled)hint.textContent='Choose SMS or WhatsApp. MSG91 widget setup is incomplete; sending will show which selected channel needs configuration.';
  else if(!smsEnabled)hint.textContent='WhatsApp is connected. SMS needs its own SMS-primary MSG91 widget. You can still select either channel.';
  else if(!whatsappEnabled)hint.textContent='SMS is connected. WhatsApp needs its own WhatsApp-primary MSG91 widget. You can still select either channel.';
  else hint.textContent='Choose SMS or WhatsApp. Only the channel you select will receive the OTP.';
 }
}
function setMode(next){
 mode=next==='signup'?'signup':'login';
 authMethod=mode==='signup'?'phone-otp':'email-otp';
 el('tab-login').classList.toggle('active',mode==='login');el('tab-signup').classList.toggle('active',mode==='signup');
 if(el('account-heading-subtitle'))el('account-heading-subtitle').textContent=mode==='signup'?'Create one account with your name, email and mobile number. Verify your mobile by SMS or WhatsApp, then confirm your email.':'Sign in using your verified email or linked mobile number. SMS and WhatsApp open the same account.';
 setMethod(authMethod);
}


const DASH_VIEW_META={
 overview:{title:'Overview dashboard',subtitle:'Your file activity, tools and workspace at a glance.'},
 analytics:{title:'Analytics & performance',subtitle:'Explore conversion trends and understand how you use your tools.'},
 reports:{title:'Reports & activity',subtitle:'Search, review and export your completed conversion history.'},
 files:{title:'Local file history',subtitle:'Review the files recorded by this browser after successful conversions.'},
 resources:{title:'Resources library',subtitle:'Guides, tool collections and support links for your file workflow.'},
 tools:{title:'PDF & image tools',subtitle:'Choose from eight focused tools for everyday PDF and image tasks.'},
 plans:{title:'Upgrade plan',subtitle:'Review your current membership and explore available plans.'},
 updates:{title:'AI updates',subtitle:'Browse engineering news and source-linked technology announcements.'},
 support:{title:'Feedback & help',subtitle:'Get support, report bugs and suggest product improvements.'},
 profile:{title:'Profile & preferences',subtitle:'Review your workspace identity, status and membership.'}
};
const DASH_TOOLS=[
 {name:'PDF to PNG',slug:'pdf-to-png',url:'../tools/pdf-to-png/',kind:'pdf'},
 {name:'Images to PDF',slug:'images-to-pdf',url:'../tools/images-to-pdf/',kind:'image'},
 {name:'Merge PDF',slug:'merge-pdf',url:'../tools/merge-pdf/',kind:'pdf'},
 {name:'Extract PDF Pages',slug:'extract-pdf-pages',url:'../tools/extract-pdf-pages/',kind:'pdf'},
 {name:'Rotate PDF',slug:'rotate-pdf',url:'../tools/rotate-pdf/',kind:'pdf'},
 {name:'Convert Image',slug:'convert-image',url:'../tools/convert-image/',kind:'image'},
 {name:'Resize Image',slug:'resize-image',url:'../tools/resize-image/',kind:'image'},
 {name:'Compress Image',slug:'compress-image',url:'../tools/compress-image/',kind:'image'}
];

const DASH_SEARCH_PAGES=[
 {label:'About CrakkerXworld.AI',description:'About the product and its tools',href:'../about/',keywords:'about company who are we product information'},
 {label:'How it works',description:'Learn how to use the PDF and image tools',href:'../how-it-works/',keywords:'guide tutorial instructions how to convert'},
 {label:'Privacy policy',description:'File handling, account data and privacy',href:'../privacy/',keywords:'privacy data security file processing'},
 {label:'Terms of use',description:'Service terms and usage limits',href:'../terms/',keywords:'terms legal conditions rules'},
 {label:'Feedback & bug reports',description:'Send feedback or report a problem',href:'../feedback/',keywords:'feedback support help bug contact feature request'},
 {label:'Pricing page',description:'Compare membership plans and prices',href:'../pricing/',keywords:'pricing membership billing payment upgrade plans'}
];
const DASH_VIEW_KEYWORDS={
 overview:'home dashboard start main summary workspace',analytics:'analytics usage statistics graph chart performance trends',
 reports:'reports activity history logs conversions completed csv export',files:'files my files file manager library recent documents outputs',
 resources:'resources guides shortcuts documentation learn help articles',tools:'all tools tool directory pdf image converter conversion utilities',
 plans:'plans upgrade billing payment payments payment history membership subscription renewal price pricing invoice transaction transactions',
 updates:'ai updates news announcements technology release notes',support:'help support feedback bug contact issue feature request customer service',
 profile:'profile account my account personal settings user details email phone sign out logout'
};
const DASH_TOOL_KEYWORDS={
 'pdf-to-png':'pdf to image convert pdf pages jpg jpeg png export pages',
 'images-to-pdf':'image to pdf photo pictures jpg jpeg png combine images',
 'merge-pdf':'combine pdf join pdf pdf merger concatenate documents',
 'extract-pdf-pages':'split pdf extract pages remove pages page selection',
 'rotate-pdf':'rotate pages pdf orientation 90 180 270',
 'convert-image':'image converter png jpg jpeg webp format change',
 'resize-image':'image resizer photo size dimensions resolution scale',
 'compress-image':'image compressor reduce optimize smaller file size'
};
let dashRowsCache=[];
let dashCurrentView='overview';
let dashWorkspaceReady=false;

function readDashboardRows(){
 try{
  const rows=JSON.parse(localStorage.getItem('cx_conversion_activity_v1')||'[]');
  return Array.isArray(rows)?rows.filter(row=>row&&typeof row==='object').sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)).slice(0,200):[];
 }catch{return [];}
}
function dashKind(row){
 const text=String(row?.tool||'').toLowerCase();
 if(/image|resize|compress/.test(text))return 'image';
 if(/pdf|merge|rotate|extract|split/.test(text))return 'pdf';
 return 'other';
}
function dashDate(value,opts={day:'numeric',month:'short',year:'numeric'}){
 const d=new Date(value);
 return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('en-IN',opts);
}
function dashBytes(value){
 const n=Math.max(0,Number(value)||0);
 if(n>=1024*1024*1024)return (n/1024/1024/1024).toFixed(2)+' GB';
 if(n>=1024*1024)return (n/1024/1024).toFixed(1)+' MB';
 if(n>=1024)return (n/1024).toFixed(0)+' KB';
 return Math.round(n)+' B';
}
function dashEl(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
}
function dashSet(id,value){
 const node=document.getElementById(id);if(node)node.textContent=String(value);
}
function dashSvg(tag,attrs={}){
 const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
 Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));
 return node;
}
function dashDailySeries(rows,days){
 const now=new Date();const series=[];
 for(let offset=days-1;offset>=0;offset--){
  const day=new Date(now);day.setHours(0,0,0,0);day.setDate(day.getDate()-offset);
  const next=new Date(day);next.setDate(next.getDate()+1);
  const values=rows.filter(row=>{const at=new Date(row.at);return !Number.isNaN(at.getTime())&&at>=day&&at<next;});
  series.push({day,count:values.length,pdf:values.filter(row=>dashKind(row)==='pdf').length,image:values.filter(row=>dashKind(row)==='image').length});
 }
 return series;
}
function renderDashLineChart(containerId,series){
 const root=document.getElementById(containerId);if(!root)return;
 root.replaceChildren();
 if(!series.length||series.every(item=>!item.count)){
  root.append(dashEl('div','dash-chart-empty','Your conversion trend will appear here after your first successful conversion.'));
  return;
 }
 const w=700,h=250,left=42,right=14,top=18,bottom=40,plotW=w-left-right,plotH=h-top-bottom;
 const max=Math.max(4,...series.map(item=>item.count));
 const step=max<=4?1:Math.ceil(max/4);
 const svg=dashSvg('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':'Successful conversions over time',preserveAspectRatio:'none'});
 const defs=dashSvg('defs');
 const gradient=dashSvg('linearGradient',{id:`${containerId}-area`,x1:'0',y1:'0',x2:'0',y2:'1'});
 gradient.append(dashSvg('stop',{offset:'0%','stop-color':'#9a56ff','stop-opacity':'.36'}),dashSvg('stop',{offset:'100%','stop-color':'#287dff','stop-opacity':'0'}));
 defs.append(gradient);svg.append(defs);
 for(let n=0;n<=4;n++){
  const y=top+(plotH*n/4);
  svg.append(dashSvg('line',{x1:left,y1:y,x2:w-right,y2:y,class:'dash-svg-grid'}));
  const label=dashSvg('text',{x:left-10,y:y+4,'text-anchor':'end',class:'dash-svg-axis'});
  label.textContent=String(Math.round(max-(max*n/4)));svg.append(label);
 }
 const points=series.map((item,index)=>({x:left+(series.length===1?plotW/2:plotW*index/(series.length-1)),y:top+plotH-(item.count/max)*plotH,item}));
 const path=points.map((point,index)=>`${index?'L':'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
 const area=`${path} L ${points[points.length-1].x} ${top+plotH} L ${points[0].x} ${top+plotH} Z`;
 svg.append(dashSvg('path',{d:area,class:'dash-svg-area',fill:`url(#${containerId}-area)`}));
 svg.append(dashSvg('path',{d:path,class:'dash-svg-line'}));
 points.forEach(point=>{
  svg.append(dashSvg('circle',{cx:point.x,cy:point.y,r:4,class:'dash-svg-point'}));
 });
 points.forEach((point,index)=>{
  if(series.length>10&&index%Math.ceil(series.length/7)!==0&&index!==series.length-1)return;
  const label=dashSvg('text',{x:point.x,y:h-13,'text-anchor':'middle',class:'dash-svg-axis'});
  label.textContent=point.item.day.toLocaleDateString('en-IN',{day:'numeric',month:'short'});svg.append(label);
 });
 root.append(svg);
}
function renderDashBars(containerId,series){
 const root=document.getElementById(containerId);if(!root)return;
 root.replaceChildren();
 const max=Math.max(1,...series.flatMap(x=>[x.pdf,x.image]));
 series.forEach(item=>{
  const group=dashEl('div','dash-bar-group');
  const bars=dashEl('div','dash-bars');
  const pdf=dashEl('span','dash-bar dash-bar-pdf');pdf.style.height=`${Math.max(2,item.pdf/max*100)}%`;pdf.title=`PDF: ${item.pdf}`;
  const image=dashEl('span','dash-bar dash-bar-image');image.style.height=`${Math.max(2,item.image/max*100)}%`;image.title=`Image: ${item.image}`;
  bars.append(pdf,image);
  const label=dashEl('small','',item.day.toLocaleDateString('en-IN',{weekday:'short'}));
  group.append(bars,label);root.append(group);
 });
 if(!series.some(x=>x.pdf||x.image))root.append(dashEl('p','dash-chart-empty','No activity recorded in this period.'));
}
function renderDashDonut(containerId,pdf,image,other=0){
 const root=document.getElementById(containerId);if(!root)return;
 const total=pdf+image+other;
 const p=total?pdf/total*100:0,i=total?(pdf+image)/total*100:0;
 root.style.background=total?`conic-gradient(#a855f7 0 ${p}%,#20c5b8 ${p}% ${i}%,#3279ee ${i}% 100%)`:'conic-gradient(#273449 0 100%)';
}
function renderDashTableBody(id,rows,columns){
 const body=document.getElementById(id);if(!body)return;
 body.replaceChildren();
 if(!rows.length){
  const tr=dashEl('tr');const td=dashEl('td','dash-empty-cell','No conversion history yet.');td.colSpan=columns;tr.append(td);body.append(tr);return;
 }
 rows.forEach(row=>{
  const tr=dashEl('tr');
  const file=dashEl('td','dash-file-name-cell');
  const icon=dashEl('span',`dash-file-type-icon ${dashKind(row)}`,dashKind(row)==='image'?'▧':'▤');
  const info=dashEl('span','dash-file-name-info');
  info.append(dashEl('strong','',row.name||'Processed file'),dashEl('small','',dashBytes(row.size)));
  file.append(icon,info);tr.append(file);
  const tool=dashEl('td','',row.tool||'File tool');tr.append(tool);
  const date=dashEl('td','',dashDate(row.at,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}));tr.append(date);
  if(columns===5){
   tr.append(dashEl('td','',dashBytes(row.size)));
   const status=dashEl('td');status.append(dashEl('span','dash-success-badge','✓ Completed'));tr.append(status);
  }else tr.append(dashEl('td','',dashBytes(row.size)));
  body.append(tr);
 });
}
function renderDashActivityCards(rows){
 const root=document.getElementById('dash-file-cards');if(!root)return;
 root.replaceChildren();
 if(!rows.length){root.append(dashEl('div','dash-empty-card','No recent conversion records. Process a file with any tool to see it appear here.'));return;}
 rows.slice(0,8).forEach(row=>{
  const card=dashEl('article',`dash-file-card ${dashKind(row)}`);
  const icon=dashEl('span','dash-file-card-icon',dashKind(row)==='image'?'▧':'▤');
  const tag=dashEl('small','dash-file-card-tag',dashKind(row)==='image'?'IMAGE OUTPUT':dashKind(row)==='pdf'?'PDF OUTPUT':'FILE OUTPUT');
  const title=dashEl('strong','',row.name||'Processed file');
  const meta=dashEl('span','',`${row.tool||'Conversion'} · ${dashDate(row.at,{day:'numeric',month:'short'})}`);
  const size=dashEl('b','',dashBytes(row.size));
  card.append(icon,tag,title,meta,size);root.append(card);
 });
}
function renderDashPopularTools(rows){
 const root=document.getElementById('dash-top-tools');if(!root)return;
 root.replaceChildren();
 const counts=new Map();
 rows.forEach(row=>{const key=String(row.tool||'Other tools');counts.set(key,(counts.get(key)||0)+1);});
 const entries=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
 if(!entries.length){root.append(dashEl('div','dash-chart-empty','Your most-used tools will appear here after conversions.'));return;}
 const max=entries[0][1];
 entries.forEach(([name,count],index)=>{
  const item=dashEl('div','dash-progress-item');const head=dashEl('div','dash-progress-head');
  head.append(dashEl('strong','',name),dashEl('span','',String(count)));
  const track=dashEl('div','dash-progress-track');const fill=dashEl('i',`dash-progress-fill tone-${index%4}`);fill.style.width=`${count/max*100}%`;track.append(fill);item.append(head,track);root.append(item);
 });
}
function renderDashCsv(rows){
 const values=[['File name','Tool','Date','Source size bytes','Status'],...rows.map(row=>[row.name||'Processed file',row.tool||'File tool',row.at||'',Number(row.size)||0,'Completed'])];
 const csv=values.map(line=>line.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=dashEl('a');a.href=url;a.download='crakkerxworld-conversion-activity.csv';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function renderUsageDashboard(){
 const rows=readDashboardRows();dashRowsCache=rows;
 const now=new Date();
 const monthRows=rows.filter(row=>{const d=new Date(row.at);return !Number.isNaN(d.getTime())&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});
 const todayRows=rows.filter(row=>{const d=new Date(row.at);return !Number.isNaN(d.getTime())&&d.toDateString()===now.toDateString();});
 const pdfRows=rows.filter(row=>dashKind(row)==='pdf'),imageRows=rows.filter(row=>dashKind(row)==='image');
 const pdf=monthRows.filter(row=>dashKind(row)==='pdf').length;
 const image=monthRows.filter(row=>dashKind(row)==='image').length;
 const other=Math.max(0,monthRows.length-pdf-image);
 const totalBytes=rows.reduce((sum,row)=>sum+(Number(row.size)||0),0);
 dashSet('dash-files-processed',rows.length);dashSet('dash-month-total',monthRows.length);
 dashSet('dash-pdf-count',pdf);dashSet('dash-image-count',image);dashSet('dash-other-count',other);
 dashSet('dash-storage-used',dashBytes(totalBytes));
 dashSet('analytics-total',rows.length);dashSet('analytics-pdf',pdfRows.length);dashSet('analytics-image',imageRows.length);dashSet('analytics-month',monthRows.length);
 dashSet('dash-category-total',rows.length);dashSet('dash-category-pdf',pdfRows.length);dashSet('dash-category-image',imageRows.length);
 dashSet('reports-total',rows.length);dashSet('reports-pdf',pdfRows.length);dashSet('reports-image',imageRows.length);dashSet('reports-size',dashBytes(totalBytes));
 dashSet('files-summary-count',`${rows.length} files recorded`);dashSet('files-summary-size',dashBytes(totalBytes));
 dashSet('dash-today-label',now.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'}));
 renderDashDonut('dash-category-donut',pdfRows.length,imageRows.length,rows.filter(row=>dashKind(row)==='other').length);
 const donut=document.getElementById('dashboard')?.querySelector('.dash-donut');
 if(donut){const p=monthRows.length?pdf/monthRows.length*100:0,i=monthRows.length?(pdf+image)/monthRows.length*100:0;donut.style.background=monthRows.length?`conic-gradient(#a855f7 0 ${p}%,#20c5b8 ${p}% ${i}%,#3279ee ${i}% 100%)`:'conic-gradient(#273449 0 100%)';}
 const series7=dashDailySeries(rows,7),series30=dashDailySeries(rows,30);
 renderDashLineChart('dash-overview-line',series7);renderDashLineChart('dash-analytics-line',series30);renderDashBars('dash-weekly-bars',series7);
 renderDashPopularTools(rows);
 renderDashTableBody('dash-activity-body',rows,5);renderDashTableBody('dash-files-body',rows,4);renderDashActivityCards(rows);
 const recent=document.getElementById('dash-recent-list');
 if(recent){
  recent.replaceChildren();
  if(!rows.length)recent.append(dashEl('div','dash-empty-activity','No processed files yet. Complete a conversion and your recent activity will appear here.'));
  else rows.slice(0,5).forEach(row=>{
   const item=dashEl('div','dash-activity-row');
   const icon=dashEl('b',`dash-activity-icon ${dashKind(row)}`,dashKind(row)==='image'?'▧':'▤');
   const info=dashEl('span','dash-activity-info');
   info.append(dashEl('strong','',row.name||'Processed file'),dashEl('small','',`${row.tool||'File tool'} · ${dashDate(row.at,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`));
   const status=dashEl('em','','Done');item.append(icon,info,status);recent.append(item);
  });
 }
 dashRefreshFilters();
 const name=document.getElementById('profile-name')?.textContent||'there';
 const email=document.getElementById('profile-email')?.textContent||'';
 const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toUpperCase()).join('')||'U';
 dashSet('dash-user-name',name);dashSet('dash-avatar',initials);dashSet('dash-menu-user-name',name);dashSet('dash-menu-user-email',email);
 dashSet('dash-profile-fullname',name);dashSet('dash-profile-name-detail',name);dashSet('dash-profile-email',email||'Email not provided');dashSet('dash-profile-contact-detail',email||'Mobile number not provided');dashSet('dash-profile-avatar',initials);dashSet('dash-profile-plan-detail',document.getElementById('dash-user-plan')?.textContent||'Free Plan');
}
function dashRefreshFilters(){
 const reportSearch=document.getElementById('dash-activity-search');
 const reportType=document.getElementById('dash-activity-filter')?.value||'all';
 const reportQuery=(reportSearch?.value||'').trim().toLowerCase();
 const filtered=dashRowsCache.filter(row=>{
  const matchType=reportType==='all'||dashKind(row)===reportType;
  const matchQuery=!reportQuery||`${row.name||''} ${row.tool||''}`.toLowerCase().includes(reportQuery);
  return matchType&&matchQuery;
 });
 renderDashTableBody('dash-activity-body',filtered,5);
 const fileSearch=(document.getElementById('dash-files-search')?.value||'').trim().toLowerCase();
 const sort=document.getElementById('dash-files-sort')?.value||'newest';
 let files=dashRowsCache.filter(row=>!fileSearch||`${row.name||''} ${row.tool||''}`.toLowerCase().includes(fileSearch));
 if(sort==='oldest')files=files.slice().reverse();
 if(sort==='largest')files=files.slice().sort((a,b)=>(Number(b.size)||0)-(Number(a.size)||0));
 renderDashActivityCards(files);renderDashTableBody('dash-files-body',files,4);
}
function setDashboardView(view,persist=true){
 const allowed=Object.hasOwn(DASH_VIEW_META,view)?view:'overview';
 dashCurrentView=allowed;
 document.querySelectorAll('[data-dashboard-panel]').forEach(panel=>{
  const active=panel.dataset.dashboardPanel===allowed;
  panel.hidden=!active;panel.classList.toggle('is-active',active);
 });
 document.querySelectorAll('[data-dashboard-view]').forEach(button=>{
  const active=button.dataset.dashboardView===allowed;
  button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');
 });
 const meta=DASH_VIEW_META[allowed];
 dashSet('dash-view-title',meta.title);dashSet('dash-view-subtitle',meta.subtitle);
 if(persist){try{sessionStorage.setItem('cx_dashboard_view',allowed);}catch{}try{const url=new URL(location.href);url.searchParams.set('view',allowed);history.replaceState(null,'',url);}catch{}}
 document.querySelector('[data-dash-profile-menu]')?.classList.add('hidden');document.querySelector('[data-dash-notification-panel]')?.classList.add('hidden');
 document.querySelector('[data-dash-profile-toggle]')?.setAttribute('aria-expanded','false');document.querySelector('[data-dash-notification-toggle]')?.setAttribute('aria-expanded','false');
 const content=document.getElementById('dashboard');
 if(content&&window.scrollY>content.getBoundingClientRect().top+window.scrollY+30)content.scrollIntoView({behavior:'smooth',block:'start'});
}
function normaliseDashboardQuery(value){
 return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function buildDashboardSearchIndex(){
 const views=Object.entries(DASH_VIEW_META).map(([id,meta])=>({type:'view',id,label:meta.title,description:meta.subtitle,category:'Workspace',keywords:DASH_VIEW_KEYWORDS[id]||''}));
 const tools=DASH_TOOLS.map(tool=>({type:'tool',id:tool.slug,label:tool.name,description:`Open ${tool.name} converter`,category:'Tool',href:tool.url,keywords:DASH_TOOL_KEYWORDS[tool.slug]||tool.kind}));
 const pages=DASH_SEARCH_PAGES.map(page=>({type:'page',id:page.href,label:page.label,description:page.description,category:'Page',href:page.href,keywords:page.keywords}));
 const notification={type:'notification',id:'notifications',label:'Notifications',description:'Open account notifications and product alerts',category:'Account',keywords:'notification notifications alert announcement updates message'};
 return [...views,...tools,...pages,notification];
}
function rankDashboardSearch(query){
 const q=normaliseDashboardQuery(query);
 const index=buildDashboardSearchIndex();
 if(!q)return index.filter(item=>['overview','tools','analytics','plans','profile','support'].includes(item.id)).slice(0,6);
 const tokens=q.split(' ').filter(Boolean);
 const ranked=index.map(item=>{
  const label=normaliseDashboardQuery(item.label),hay=normaliseDashboardQuery(`${item.label} ${item.description} ${item.category} ${item.keywords||''}`);
  let score=0;
  if(label===q)score+=160;
  else if(label.startsWith(q))score+=125;
  else if(label.includes(q))score+=95;
  if(hay.includes(q))score+=55;
  for(const token of tokens){
   if(label.split(' ').includes(token))score+=24;
   else if(label.includes(token))score+=13;
   else if(hay.includes(token))score+=7;
  }
  return {...item,score};
 }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
 // Add recent processed files as direct searchable records, while keeping source files local.
 const recent=dashRowsCache.filter(row=>normaliseDashboardQuery(`${row.name||''} ${row.tool||''}`).includes(q)).slice(0,4).map((row,index)=>({
  type:'file',id:`file-${index}`,label:row.name||'Processed file',description:`${row.tool||'Conversion'} · ${dashDate(row.at,{day:'numeric',month:'short'})}`,
  category:'Recent file',row,score:90
 }));
 return [...recent,...ranked].sort((a,b)=>b.score-a.score).slice(0,12);
}
function closeDashboardSearch(){
 const box=document.getElementById('dash-search-results');const input=document.getElementById('dash-search');
 box?.classList.add('hidden');input?.setAttribute('aria-expanded','false');input?.removeAttribute('aria-activedescendant');
}
function chooseDashboardSearchResult(result){
 closeDashboardSearch();
 const search=document.getElementById('dash-search'),side=document.getElementById('dash-side-search');
 if(search)search.value='';if(side)side.value='';
 if(result.type==='view'){setDashboardView(result.id);return;}
 if(result.type==='tool'||result.type==='page'){location.assign(result.href);return;}
 if(result.type==='notification'){const panel=document.querySelector('[data-dash-notification-panel]');const toggle=document.querySelector('[data-dash-notification-toggle]');panel?.classList.remove('hidden');toggle?.setAttribute('aria-expanded','true');return;}
 if(result.type==='file'){
  setDashboardView('reports');
  const reportSearch=document.getElementById('dash-activity-search');
  if(reportSearch){reportSearch.value=result.row?.name||'';dashRefreshFilters();}
 }
}
function renderDashboardSearch(query){
 const box=document.getElementById('dash-search-results');const input=document.getElementById('dash-search');
 if(!box||!input)return [];
 const results=rankDashboardSearch(query);box.replaceChildren();
 if(!results.length){
  const empty=dashEl('div','dash-search-empty','No matching tools or pages. Try “PDF”, “billing”, “profile” or “help”.');box.append(empty);
 }else{
  const label=dashEl('div','dash-search-caption',query.trim()?'SEARCH RESULTS':'QUICK ACCESS');box.append(label);
  results.forEach((result,index)=>{
   const button=dashEl('button','dash-search-result');button.type='button';button.id=`dash-search-result-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');
   const icon=dashEl('span',`dash-search-result-icon ${result.type}`,result.type==='tool'?'▤':result.type==='page'?'↗':result.type==='file'?'▣':'◈');
   const text=dashEl('span','dash-search-result-text');text.append(dashEl('strong','',result.label),dashEl('small','',result.description));
   const category=dashEl('em','dash-search-result-category',result.category);button.append(icon,text,category);
   button.addEventListener('mousedown',event=>event.preventDefault());
   button.addEventListener('click',()=>chooseDashboardSearchResult(result));box.append(button);
  });
 }
 box.classList.remove('hidden');input.setAttribute('aria-expanded','true');
 return results;
}
function initDashboardSearch(search,sideSearch){
 const shell=document.getElementById('dash-search-shell');let results=[];let activeIndex=-1;
 const paint=(query)=>{results=renderDashboardSearch(query);activeIndex=-1;};
 const syncFrom=(source)=>{
  const other=source===search?sideSearch:search;
  if(other)other.value=source.value;
  paint(source.value);
 };
 [search,sideSearch].filter(Boolean).forEach(input=>{
  input.addEventListener('input',()=>syncFrom(input));
  input.addEventListener('focus',()=>{if(input.value.trim())paint(input.value);else paint('');});
  input.addEventListener('keydown',event=>{
   if(event.key==='Escape'){closeDashboardSearch();return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();if(!results.length)paint(input.value);
    activeIndex=event.key==='ArrowDown'?Math.min(activeIndex+1,results.length-1):Math.max(activeIndex-1,0);
    const options=[...(document.querySelectorAll('#dash-search-results .dash-search-result'))];
    options.forEach((option,index)=>{option.setAttribute('aria-selected',String(index===activeIndex));if(index===activeIndex)option.scrollIntoView({block:'nearest'});});
    input.setAttribute('aria-activedescendant',options[activeIndex]?.id||'');return;
   }
   if(event.key==='Enter'){
    event.preventDefault();if(!results.length)paint(input.value);
    if(results[activeIndex])chooseDashboardSearchResult(results[activeIndex]);
    else if(results[0])chooseDashboardSearchResult(results[0]);
   }
  });
 });
 document.addEventListener('pointerdown',event=>{
  if(shell&&!shell.contains(event.target)&&!document.querySelector('.dash-side-search')?.contains(event.target))closeDashboardSearch();
 });
}
function initDashboardTopbarMenus(){
 const profileToggle=document.querySelector('[data-dash-profile-toggle]');
 const profileMenu=document.querySelector('[data-dash-profile-menu]');
 const notificationToggle=document.querySelector('[data-dash-notification-toggle]');
 const notificationPanel=document.querySelector('[data-dash-notification-panel]');
 const closeMenus=()=>{
  profileMenu?.classList.add('hidden');notificationPanel?.classList.add('hidden');
  profileToggle?.setAttribute('aria-expanded','false');notificationToggle?.setAttribute('aria-expanded','false');
 };
 profileToggle?.addEventListener('click',()=>{
  const open=profileMenu?.classList.contains('hidden');closeMenus();
  if(open){profileMenu?.classList.remove('hidden');profileToggle.setAttribute('aria-expanded','true');}
 });
 notificationToggle?.addEventListener('click',()=>{
  const open=notificationPanel?.classList.contains('hidden');closeMenus();
  if(open){notificationPanel?.classList.remove('hidden');notificationToggle.setAttribute('aria-expanded','true');}
 });
 document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('.dash-user-menu-wrap,.dash-notification-wrap'))closeMenus();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenus();});
 document.querySelectorAll('[data-dashboard-goto]').forEach(button=>button.addEventListener('click',closeMenus));
 document.querySelector('[data-dashboard-signout]')?.addEventListener('click',()=>document.getElementById('logout')?.click());
}

function initDashboardWorkspace(){
 if(dashWorkspaceReady)return;dashWorkspaceReady=true;
 document.querySelectorAll('[data-dashboard-view]').forEach(button=>button.addEventListener('click',()=>setDashboardView(button.dataset.dashboardView)));
 document.querySelectorAll('[data-dashboard-view]').forEach(button=>{if(!button.title)button.title=button.textContent.trim();});
 document.querySelectorAll('[data-dashboard-goto]').forEach(button=>button.addEventListener('click',()=>setDashboardView(button.dataset.dashboardGoto)));
 const reportSearch=document.getElementById('dash-activity-search'),reportType=document.getElementById('dash-activity-filter');
 const fileSearch=document.getElementById('dash-files-search'),fileSort=document.getElementById('dash-files-sort');
 reportSearch?.addEventListener('input',dashRefreshFilters);reportType?.addEventListener('change',dashRefreshFilters);
 fileSearch?.addEventListener('input',dashRefreshFilters);fileSort?.addEventListener('change',dashRefreshFilters);
 document.getElementById('dash-export-activity')?.addEventListener('click',()=>{
  const type=reportType?.value||'all',query=(reportSearch?.value||'').trim().toLowerCase();
  const rows=dashRowsCache.filter(row=>(type==='all'||dashKind(row)===type)&&(!query||`${row.name||''} ${row.tool||''}`.toLowerCase().includes(query)));
  renderDashCsv(rows);
 });
 const search=document.getElementById('dash-search');
 const sideSearch=document.getElementById('dash-side-search');
 const sidebarToggle=document.querySelector('[data-sidebar-toggle]');
 const applySidebarState=(collapsed)=>{
  document.getElementById('dashboard')?.classList.toggle('sidebar-collapsed',collapsed);
  sidebarToggle?.setAttribute('aria-expanded',String(!collapsed));
  sidebarToggle?.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
  sidebarToggle?.setAttribute('title',collapsed?'Expand sidebar':'Collapse sidebar');
  const glyph=sidebarToggle?.querySelector('.sidebar-toggle-glyph');if(glyph)glyph.textContent=collapsed?'›':'‹';
 };
 let sidebarCollapsed=false;try{sidebarCollapsed=localStorage.getItem('cx_dashboard_sidebar_collapsed')==='1';}catch{}
 applySidebarState(sidebarCollapsed);
 sidebarToggle?.addEventListener('click',()=>{sidebarCollapsed=!sidebarCollapsed;applySidebarState(sidebarCollapsed);try{localStorage.setItem('cx_dashboard_sidebar_collapsed',sidebarCollapsed?'1':'0');}catch{}});
 initDashboardSearch(search,sideSearch);
 initDashboardTopbarMenus();
 document.querySelector('[data-dash-top]')?.addEventListener('click',()=>document.getElementById('dashboard')?.scrollIntoView({behavior:'smooth',block:'start'}));
 // A fresh visit and every successful sign-in open Overview by default.
 // Profile is shown only when the user explicitly requests ?view=profile.
 const params=new URLSearchParams(location.search);
 const initial=params.get('view')||'overview';
 setDashboardView(initial,false);
}
function parsePending(){const params=new URLSearchParams(location.search);const candidate=params.get('plan');return PAID_PLAN_IDS.includes(candidate)?candidate:'';}
async function loadPasswordPolicy(session){
 let workerError=null;
 try{return await apiRequest('/api/auth/password-policy',session.access_token);}
 catch(error){workerError=error;}
 // Fallback: read only the signed-in user's own policy row through Supabase RLS.
 // The migration grants authenticated SELECT with auth.uid() = user_id; clients
 // cannot insert, update, or inspect another user's password-security record.
 try{
  const {data,error}=await client.from('account_password_security')
   .select('password_changed_at,password_setup_required,password_setup_reason')
   .eq('user_id',session.user.id).maybeSingle();
  if(error)throw error;
  return normalizePasswordPolicyRow(data);
 }catch(error){
  const workerMessage=workerError?.message||'Worker password-policy request failed';
  const directMessage=error?.message||'Authenticated Supabase policy read failed';
  throw new Error(`Password security could not be checked. Worker: ${workerMessage}. Secure account lookup: ${directMessage}. Apply the latest 20261120 password-policy migration in the same Supabase project used by this website, then deploy the latest crakkerxai-tools code.`);
 }
}
async function verifyCurrentPasswordForSession(session,password){
 const email=String(session?.user?.email||'').trim();
 if(!email){
  await apiRequest('/api/auth/verify-current-password',session.access_token,{method:'POST',body:{password}});
  return;
 }
 // Re-authenticate the same identity using the active Supabase client. This avoids
 // relying on a Worker-to-Supabase round trip merely to verify the user's password.
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error)throw new Error('Current password is incorrect. Check your old password and try again.');
 if(data?.user?.id!==session.user.id){await client.auth.signOut();throw new Error('The password was verified for a different account. You have been signed out for safety. Sign in again.');}
}
async function refreshIdentityManagement(session){
 const panel=el('identity-management-panel');if(!panel||!session?.access_token)return;
 hide('identity-management-panel',false);
 try{
  const status=await apiRequest('/api/auth/identity-status',session.access_token);
  if(status.syntheticEmail){
   label('identity-link-status','Your mobile account is active. Add and verify a real email address to enable email login on this same account.');
   hide('identity-phone-link-form');
  }else if(status.phone){
   label('identity-link-status',`Email and mobile are connected to this workspace · ${status.phone}. Use email OTP, SMS or WhatsApp to sign in to this account.`);
   hide('identity-phone-link-form');
  }else{
   label('identity-link-status','Your email is verified. Link a mobile number so SMS and WhatsApp login open this same account.');
   hide('identity-phone-link-form',false);
  }
  hide('identity-email-link-form',!status.syntheticEmail);
  if(status.email&&!status.syntheticEmail)el('identity-link-email').value=status.email;
  if(status.phone)el('identity-link-phone').value=status.phone;
 }catch(error){
  label('identity-link-status','Could not load linked sign-in methods. Refresh the page to try again.');
  console.error('Account identity status could not be loaded:',error);
  return null;
 }
}
async function requestIdentityPhoneLinkOtp(){
 notice('');
 try{
  const session=await getSession();if(!session)throw new Error('Sign in again before linking a mobile number.');
  const phone=normalizeOtpPhone(el('identity-link-phone').value);
  const channel=document.querySelector('input[name="identity-phone-channel"]:checked')?.value||selectedIdentityChannel;
  if(channel==='sms'&&!config?.msg91SmsEnabled)throw new Error('SMS verification is not configured.');
  if(channel==='whatsapp'&&!config?.msg91WhatsappEnabled)throw new Error('WhatsApp verification is not configured.');
  const sent=await sendMsg91Otp(phone,config,channel);
  identityLinkContext={phone,channel,reqId:sent.reqId,sentAt:Date.now(),userId:session.user.id};
  el('identity-link-otp').value='';hide('identity-link-otp-field',false);
  notice(`Verification code sent via ${channel==='whatsapp'?'WhatsApp':'SMS'}.`);
  el('identity-link-otp').focus();
 }catch(error){notice(error?.message||'Could not send the verification code.',true);}
}
async function verifyIdentityPhoneLinkOtp(){
 if(!identityLinkContext){notice('Request a mobile verification code first.',true);return;}
 const button=el('identity-verify-phone-otp');button.disabled=true;
 try{
  const session=await getSession();
  if(!session||session.user.id!==identityLinkContext.userId)throw new Error('Your account session changed. Sign in again.');
  const accessToken=await verifyMsg91Otp(normalizeOtpCode(el('identity-link-otp').value),identityLinkContext.reqId);
  const pendingLink=await apiRequest('/api/auth/msg91/prepare-signup',null,{method:'POST',body:{
   accessToken,email:session.user.email,fullName:session.user.user_metadata?.full_name||session.user.user_metadata?.name||'',channel:identityLinkContext.channel
  }});
  const result=await apiRequest('/api/auth/msg91/link-signup',session.access_token,{method:'POST',body:{pendingSignupId:pendingLink.pendingSignupId}});
  identityLinkContext=null;hide('identity-link-otp-field');
  notice(result.mergedLegacyAccount?'Mobile linked. Your previous mobile-only profile and its available account records were consolidated into this email account.':'Mobile number linked successfully. Email, SMS and WhatsApp now open this same account.');
  await refreshIdentityManagement(await getSession());
 }catch(error){
  const message=String(error?.message||'');
  identityLinkContext=null;hide('identity-link-otp-field');
  notice(message||'Mobile verification failed. Request a fresh OTP and try again.',true);
 }finally{button.disabled=false;}
}
async function requestIdentityEmailLink(){
 notice('');
 try{
  const session=await getSession();
  if(!session||!session.user?.phone)throw new Error('Your verified mobile session is missing. Sign in again using mobile OTP.');
  const email=normalizeOtpEmail(el('identity-link-email').value);
  if(!email)throw new Error('Enter a valid email address.');
  const channel=document.querySelector('input[name="identity-email-channel"]:checked')?.value||selectedIdentityEmailChannel;
  if(channel==='sms'&&!config?.msg91SmsEnabled)throw new Error('SMS verification is not configured.');
  if(channel==='whatsapp'&&!config?.msg91WhatsappEnabled)throw new Error('WhatsApp verification is not configured.');
  const phone=normalizeOtpPhone(session.user.phone);
  const sent=await sendMsg91Otp(phone,config,channel);
  otpContext={kind:'identity-email-link-phone',value:phone,email,full_name:session.user.user_metadata?.full_name||session.user.user_metadata?.name||'',mode:'signup',channel,reqId:sent.reqId,sentAt:Date.now(),sourceUserId:session.user.id};
  label('otp-target',maskOtpDestination('phone',phone));
  el('otp-code').value='';hide('auth-panel');hide('otp-panel',false);hide('otp-whatsapp');
  label('otp-resend',channel==='whatsapp'?'Resend via WhatsApp':'Resend via SMS');
  notice(`Mobile verification requested via ${channel==='whatsapp'?'WhatsApp':'SMS'}. After that, you will verify the email to connect both to one account.`);
  el('otp-code').focus();
 }catch(error){notice(error?.message||'Could not start email linking. Please try again.',true);}
}

async function render(){
 const session=await getSession();
 activeAccountSession=session||null;
 hide('account-loading');
 if(!session){
  hide('password-setup');hide('password-security-unavailable');hide('dashboard');
  hide('auth-panel',Boolean(otpContext));hide('otp-panel',!otpContext);
  if(el('account-heading-title'))el('account-heading-title').innerHTML='Welcome <span>back.</span>';
  if(el('account-heading-subtitle'))el('account-heading-subtitle').textContent='Sign up or log in with email OTP, mobile OTP, password, Google or GitHub. Free tools never require an account.';
  return;
 }
 let passwordPolicy;
 try{passwordPolicy=await loadPasswordPolicy(session);}
 catch(error){showPasswordPolicyUnavailable(error);console.error('Password security policy could not be loaded:',error);return;}
 if(passwordPolicy?.mustSetPassword){showPasswordSetup(passwordPolicy);return;}
 hide('password-setup');hide('password-security-unavailable');hide('auth-panel');hide('otp-panel');hide('dashboard',false);
 if(el('account-heading-title'))el('account-heading-title').innerHTML='Your <span>workspace.</span>';
 if(el('account-heading-subtitle'))el('account-heading-subtitle').textContent='Manage your profile, connected sign-in methods, membership and personal settings.';
 const user=session.user;
 const fullName=String(user.user_metadata?.full_name||user.user_metadata?.name||user.user_metadata?.preferred_name||user.email?.split('@')[0]||'Workspace').trim();
 label('profile-name',fullName);
 await refreshIdentityManagement(session);
 // Keep the authenticated dashboard visible even if a non-critical analytics widget fails.
 // A dashboard rendering error must never send an already signed-in user back to the login form.
 try{renderUsageDashboard();}
 catch(error){console.error('Workspace analytics could not be rendered:',error);notice('You are signed in. Some workspace activity panels could not be loaded; refresh the page to try again.',true);}
 let accountData=null;
 try{accountData=await apiRequest('/api/me',session.access_token);}catch(error){console.warn('Profile and membership details could not be loaded:',error?.message||error);}
 const identity=await apiRequest('/api/auth/identity-status',session.access_token).catch(()=>null);
 const profileName=String(accountData?.user?.fullName||fullName||'Workspace');
 const email=String(accountData?.user?.email||identity?.email||user.email||'');
 const phone=String(identity?.phone||accountData?.user?.phone||user.phone||'');
 const initials=profileName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'U';
 label('profile-name',profileName);
 label('dash-user-name',profileName);label('dash-menu-user-name',profileName);label('dash-menu-user-email',email||phone||'');label('dash-avatar',initials);label('dash-profile-avatar',initials);
 label('dash-profile-fullname',profileName);label('dash-profile-name-detail',profileName);
 label('dash-profile-email',email||'No email linked');label('dash-profile-email-detail',email||'Not linked');
 label('dash-profile-phone-detail',phone||'Not linked');
 label('dash-profile-email-status',identity?.emailVerified?'Verified':email?'Pending verification':'Not linked');
 label('dash-profile-phone-status',identity?.phoneVerified?'Verified':phone?'Linked':'Not linked');
 if(el('profile-display-name'))el('profile-display-name').value=profileName;
 const activePlan=accountData?.plan||'free';
 const planLabel=PLANS[activePlan]?.label||'Free';
 label('plan-name',planLabel);label('dash-user-plan',planLabel+' Plan');label('dash-plan-pill',planLabel+' Plan');label('dash-plan-view-label',planLabel+' Plan');label('dash-plan-view-current',planLabel+' Plan');label('dash-profile-plan-detail',planLabel+' Plan');
 label('dash-profile-expiry-detail',accountData?.expiresAt?new Date(accountData.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'No expiry');
 label('plan-expires',accountData?.expiresAt?new Date(accountData.expiresAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Free tools remain available');
 const paymentSource=el('payment-history');
 if(paymentSource){
  paymentSource.replaceChildren();
  if(!accountData?.history?.length){const p=document.createElement('p');p.textContent=config.paymentsEnabled?'No payments yet.':'Payments are not active yet. No transactions to show.';paymentSource.append(p);}
  else for(const entry of accountData.history){
   const row=document.createElement('div');row.className='history-row';
   const a=document.createElement('strong');a.textContent=`${PLANS[entry.plan]?.label||'Plan'} · ₹${(Number(entry.amount_paise||0)/100).toFixed(2)}`;
   const b=document.createElement('span');b.textContent=entry.paid_at?new Date(entry.paid_at).toLocaleDateString('en-IN'):'Paid';row.append(a,b);paymentSource.append(row);
  }
 }
 const planPaymentTarget=el('dash-plan-payment-history');
 if(paymentSource&&planPaymentTarget)planPaymentTarget.replaceChildren(...Array.from(paymentSource.childNodes).map(node=>node.cloneNode(true)));
 hide('pending-plan-box',!pending);
 if(pending)label('pending-plan-text',`Selected: ${PLANS[pending].label} · ₹${PLANS[pending].price} for 30 days, one-time payment.`);
 hide('payments-unavailable',config.paymentsEnabled);
 if(el('checkout-btn'))el('checkout-btn').disabled=!config.paymentsEnabled||buying;
 await loadAccountPreferences(session);
 if(location.hash==='#payment-history')requestAnimationFrame(()=>el('payment-history-title')?.scrollIntoView({block:'start'}));
}
function showReset(){hide('auth-panel');hide('dashboard');hide('password-setup');hide('password-security-unavailable');hide('password-recovery',false);hide('account-loading');}
function showPasswordSetup(policy){
 hide('account-loading');hide('auth-panel');hide('otp-panel');hide('password-recovery');hide('password-security-unavailable');hide('dashboard');hide('password-setup',false);
 if(el('account-heading-title'))el('account-heading-title').innerHTML='Secure your <span>account.</span>';
 const aged=Number.isFinite(policy?.passwordAgeDays)&&policy.passwordAgeDays>=60;
 const legacy=policy?.passwordSetupReason==='legacy_rollout';
 const verifiedEmailOtp=hasFreshEmailOtpPasswordSetupProof(activeAccountSession?.user?.id);
 // A verified email OTP is an account-recovery proof. For legacy accounts whose
 // change timestamp is NULL, it is sufficient to set the first known 60-day
 // baseline; do not ask for an old password the user may not know.
 const requireCurrentPassword=requiresCurrentPasswordForSetup(policy,{verifiedEmailOtp});
 const legacyOtpSetup=legacy&&!requireCurrentPassword&&verifiedEmailOtp;
 hide('setup-current-password-field',!requireCurrentPassword);
 if(el('setup-current-password'))el('setup-current-password').required=requireCurrentPassword;
 if(el('account-heading-subtitle'))el('account-heading-subtitle').textContent=aged?'Your password is at least 60 days old. Confirm your current password and choose a new one before continuing.':legacyOtpSetup?'Your email address is verified. Choose a new password to establish the 60-day security baseline; your previous password is not required.':legacy?'We are activating password-age protection. Confirm your current password and refresh it once to continue.':'One more step: set a password before using your new account. You will sign in again with that password.';
 if(el('password-setup-title'))el('password-setup-title').textContent=aged?'Update your password to continue':legacyOtpSetup?'Set your account password':legacy?'Refresh your account password':'Set your account password';
 if(el('password-setup-copy'))el('password-setup-copy').textContent=aged?'Enter your current password, then a new password and confirmation. Passwords must be updated every 60 days.':legacyOtpSetup?'Your email OTP has verified this account. Create and confirm a password; no previous password is needed for this one-time setup.':'Your account was verified. Create and confirm a password; an old password is not needed for first-time setup.';
}
function showPasswordPolicyUnavailable(error){
 hide('account-loading');hide('auth-panel');hide('otp-panel');hide('password-recovery');hide('password-setup');hide('dashboard');hide('password-security-unavailable',false);
 if(el('account-heading-title'))el('account-heading-title').innerHTML='Account <span>security check.</span>';
 if(el('account-heading-subtitle'))el('account-heading-subtitle').textContent='Your sign-in was detected, but we could not confirm the password policy.';
 notice(error?.message||'Password security is not configured. Apply the password policy migration and deploy the latest Worker.',true);
}
function requirePassword(password){if(!password||password.length<10||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))throw new Error('Use 10+ characters with at least one letter and one number.');}
async function requestOtp(){
 const isPhone=authMethod==='phone-otp';
 const value=isPhone?normalizeOtpPhone(el('auth-phone').value):normalizeOtpEmail(el('auth-email').value);
 const full_name=el('auth-name').value.trim().slice(0,80);
 const signupEmail=mode==='signup'?normalizeOtpEmail(el('auth-email').value):'';
 if(mode==='signup'&&!signupEmail)throw new Error('Enter a valid email address for your account.');
 if(isPhone){
  if(selectedPhoneOtpChannel==='sms'&&!Boolean(config.msg91SmsEnabled??config.msg91Enabled))throw new Error('SMS OTP is not configured. Configure the SMS widget in Cloudflare and MSG91.');
  if(selectedPhoneOtpChannel==='whatsapp'&&!config.msg91WhatsappEnabled)throw new Error('WhatsApp OTP is not configured. Configure a WhatsApp-primary MSG91 widget before selecting this channel.');
  let sent;
  try{sent=await sendMsg91Otp(value,config,selectedPhoneOtpChannel);}
  catch(error){
   const message=String(error?.message||error||'');
   if(/AuthenticationFailure|authentication failed/i.test(message)){
    throw new Error('MSG91 could not authenticate this OTP widget. Check that MSG91_AUTHKEY, MSG91_WIDGET_TOKEN and MSG91_WIDGET_ID belong to the same MSG91 account/widget, and that https://www.crakkerxai.com is allowed in the widget domain settings.');
   }
   throw error;
  }
  otpContext={kind:'msg91',value,mode,full_name,email:signupEmail,channel:selectedPhoneOtpChannel,reqId:sent.reqId,sentAt:Date.now()};
  label('otp-target',maskOtpDestination('phone',value));
  el('otp-code').value='';hide('auth-panel');hide('otp-panel',false);hide('otp-whatsapp');
  label('otp-resend',selectedPhoneOtpChannel==='whatsapp'?'Resend via WhatsApp':'Resend via SMS');
  notice(mode==='signup'?'Mobile OTP requested. After phone verification, we will verify your email to create one linked account.':selectedPhoneOtpChannel==='whatsapp'?'WhatsApp OTP requested. Check WhatsApp.':'SMS OTP requested. Check your messages.');
  el('otp-code').focus();return;
 }
 const options={shouldCreateUser:mode==='signup',data:mode==='signup'&&full_name?{full_name}:{}};
 const {error}=await client.auth.signInWithOtp({email:value,options:{...options,emailRedirectTo:profileRedirectUrl()}});
 if(error)throw error;
 otpContext={kind:'email',value,mode,sentAt:Date.now()};
 label('otp-target',maskOtpDestination('email',value));
 el('otp-code').value='';hide('auth-panel');hide('otp-panel',false);hide('otp-whatsapp');
 notice('Email OTP requested. Check your inbox and spam folder.');
 el('otp-code').focus();
}
async function verifyOtp(event){
 event.preventDefault();notice('');
 if(!otpContext){notice('Request a new OTP first.',true);return;}
 const button=el('otp-verify-btn');button.disabled=true;
 let msg91ProofVerified=false;
 try{
  const token=normalizeOtpCode(el('otp-code').value);
  let result;
  if(otpContext.kind==='msg91'||otpContext.kind==='identity-email-link-phone'){
   const accessToken=await verifyMsg91Otp(token,otpContext.reqId);
   msg91ProofVerified=true;
   if(otpContext.mode==='signup'){
    const pending=await apiRequest('/api/auth/msg91/prepare-signup',null,{method:'POST',body:{
     accessToken,email:otpContext.email,fullName:otpContext.full_name||'',channel:otpContext.channel||'sms'
    }});
    const signupContext=otpContext;
    const {error}=await client.auth.signInWithOtp({email:signupContext.email,options:{
     shouldCreateUser:true,data:signupContext.full_name?{full_name:signupContext.full_name}:{},emailRedirectTo:profileRedirectUrl()
    }});
    if(error)throw error;
    otpContext={kind:'signup-email',value:signupContext.email,mode:'signup',pendingSignupId:pending.pendingSignupId,sentAt:Date.now()};
    label('otp-target',maskOtpDestination('email',signupContext.email));
    label('otp-resend','Resend email OTP');
    el('otp-code').value='';hide('auth-panel');hide('otp-panel',false);hide('otp-whatsapp');
    notice('Mobile verified. Check your email for the final verification code. Both sign-in methods will use one account.');
    el('otp-code').focus();return;
   }
   const proof=await apiRequest('/api/auth/msg91',null,{method:'POST',body:{accessToken,signup:false,channel:otpContext.channel||'sms'}});
   result=await client.auth.verifyOtp({token_hash:proof.tokenHash,type:'magiclink'});
  }else if(otpContext.kind==='signup-email'){
   const signupContext=otpContext;
   result=await client.auth.verifyOtp({email:signupContext.value,token,type:'email'});
   if(result.error)throw result.error;
   if(!result.data?.session)throw new Error('Email verification did not create a session. Request a new email code.');
   const linked=await apiRequest('/api/auth/msg91/link-signup',result.data.session.access_token,{method:'POST',body:{pendingSignupId:signupContext.pendingSignupId}});
   if(!linked.linked)throw new Error('Email verified, but your mobile number was not linked. Please retry account verification.');
   storeEmailOtpPasswordSetupProof(result.data.session.user.id);
   otpContext=null;window.location.assign('/account/?view=overview');return;
  }else{
   result=await client.auth.verifyOtp({email:otpContext.value,token,type:'email'});
  }
  if(result.error)throw result.error;
  if(!result.data?.session)throw new Error('OTP was not verified. Please try again.');
  if(otpContext.kind==='email')storeEmailOtpPasswordSetupProof(result.data.session.user.id);
  else clearEmailOtpPasswordSetupProof();
  otpContext=null;window.location.assign('/account/?view=overview');return;
 }catch(e){
  if(msg91ProofVerified&&otpContext?.kind==='identity-email-link-phone'){
   const channel=otpContext.channel==='whatsapp'?'WhatsApp':'SMS';
   otpContext=null;
   if(el('otp-code'))el('otp-code').value='';
   hide('otp-panel');hide('auth-panel');
   notice(`${e.message||'Email linking could not be completed.'} Request a fresh ${channel} code from your profile to try again.`,true);
  }else if(msg91ProofVerified&&otpContext?.kind==='msg91'){
   const channel=otpContext.channel==='whatsapp'?'WhatsApp':'SMS';
   otpContext=null;
   if(el('otp-code'))el('otp-code').value='';
   hide('otp-panel');hide('auth-panel',false);
   notice(`${e.message||'Account sign-in could not be completed.'} The provider has already verified that code. Request a fresh ${channel} OTP before trying again.`,true);
  }else{
   notice(e.message||'Could not verify the OTP.',true);
  }
 }finally{button.disabled=false;}
}

async function resendOtp(){
 if(!otpContext)return;
 const seconds=Math.ceil((60000-(Date.now()-otpContext.sentAt))/1000);
 if(seconds>0){notice(`Wait ${seconds} seconds before requesting another OTP.`,true);return;}
 try{
  if(otpContext.kind==='msg91'||otpContext.kind==='identity-email-link-phone'){
   const sent=await resendMsg91Otp(otpContext.channel||'sms',otpContext.reqId);
   otpContext.reqId=sent.reqId;otpContext.sentAt=Date.now();
   notice((otpContext.channel==='whatsapp'?'WhatsApp':'SMS')+' OTP resent. Use the latest code.');return;
  }
  const {value,mode:otpMode}=otpContext;
  const {error}=await client.auth.signInWithOtp({email:value,options:{emailRedirectTo:profileRedirectUrl(),shouldCreateUser:otpMode==='signup'}});
  if(error)throw error;
  otpContext.sentAt=Date.now();notice('New OTP requested. Use the latest code.');
 }catch(e){notice(e.message||'Could not resend OTP.',true);}
}
const PASSWORD_HUMAN_HOLD_MS=1600;
function resetPasswordHumanCheck(clearChallenge=true){
 if(passwordHumanTimer)clearTimeout(passwordHumanTimer);
 passwordHumanTimer=null;passwordHumanStartedAt=0;passwordHumanHeldMs=0;passwordHumanState='idle';
 if(clearChallenge)passwordHumanChallenge=null;
 const button=el('password-human-hold');
 button?.classList.remove('is-holding','is-verified');
 if(button)button.disabled=true;
 label('password-human-badge','Not verified');
 label('password-human-status','Preparing your human check…');
}
async function loadPasswordHumanChallenge(force=false){
 const panel=el('password-human-check');
 if(!panel||panel.classList.contains('hidden')||mode!=='login'||authMethod!=='password')return;
 if(!force&&passwordHumanChallenge&&Date.parse(passwordHumanChallenge.expiresAt)>Date.now()&&passwordHumanState!=='used')return;
 resetPasswordHumanCheck(true);
 passwordHumanState='loading';
 label('password-human-badge','Loading');
 label('password-human-status','Preparing your human check…');
 try{
  const result=await apiRequest('/api/auth/password-human-challenge',null,{method:'POST',body:{kind:'pool_hold_confirm'}});
  if(!result?.challengeId||!result?.expiresAt)throw new Error('Human verification could not be started. Refresh and try again.');
  passwordHumanChallenge=result;passwordHumanState='ready';
  const button=el('password-human-hold');if(button){button.disabled=false;button.classList.remove('is-holding','is-verified');}
  label('password-human-badge','Ready');
  label('password-human-status','Press and hold the pool table for 1.6 seconds.');
 }catch(error){
  passwordHumanChallenge=null;passwordHumanState='error';
  const button=el('password-human-hold');if(button)button.disabled=true;
  label('password-human-badge','Unavailable');
  label('password-human-status',error?.message||'Human verification is unavailable. Please refresh and try again.');
 }
}
function beginPasswordHumanHold(event){
 if(passwordHumanState!=='ready'||!passwordHumanChallenge)return;
 if(event?.type==='keydown'&&(event.repeat||![' ','Enter'].includes(event.key)))return;
 event?.preventDefault?.();
 if(event?.type==='pointerdown'&&event.currentTarget?.setPointerCapture){try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}}
 if(passwordHumanTimer)clearTimeout(passwordHumanTimer);
 passwordHumanStartedAt=Date.now();passwordHumanState='holding';
 const button=el('password-human-hold');button?.classList.add('is-holding');
 label('password-human-badge','Hold');
 label('password-human-status','Keep holding…');
 passwordHumanTimer=setTimeout(()=>{
  if(passwordHumanState!=='holding')return;
  passwordHumanHeldMs=Math.max(PASSWORD_HUMAN_HOLD_MS,Date.now()-passwordHumanStartedAt);
  passwordHumanState='verified';passwordHumanTimer=null;
  const control=el('password-human-hold');control?.classList.remove('is-holding');control?.classList.add('is-verified');if(control)control.disabled=true;
  label('password-human-badge','Verified');
  label('password-human-status','Human check complete. You can now sign in.');
 },PASSWORD_HUMAN_HOLD_MS);
}
function endPasswordHumanHold(event){
 if(event?.type==='keyup'&&![' ','Enter'].includes(event.key))return;
 if(passwordHumanState!=='holding')return;
 if(passwordHumanTimer)clearTimeout(passwordHumanTimer);
 passwordHumanTimer=null;passwordHumanState='ready';passwordHumanStartedAt=0;
 el('password-human-hold')?.classList.remove('is-holding');
 label('password-human-badge','Not verified');
 label('password-human-status','Keep holding until the cue ball reaches the pocket.');
}

async function authAction(event){
 event.preventDefault();notice('');
 if(authMethod==='password')clearEmailOtpPasswordSetupProof();
 const button=el('auth-submit');button.disabled=true;
 try{
  if(authMethod!=='password'){await requestOtp();return;}
  const password=el('auth-password').value;
  if(mode==='signup'){
   const email=normalizeOtpEmail(el('auth-email').value);requirePassword(password);
   const full_name=el('auth-name').value.trim().slice(0,80);
   const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:profileRedirectUrl(),data:{full_name}}});
   if(error)throw error;
   if(!data.session)notice('Check your verification email. Your password is saved; sign in after email verification.');
   else{window.location.assign('/account/?view=overview');return;}
  }else{
   if(passwordHumanState!=='verified'||!passwordHumanChallenge||Date.parse(passwordHumanChallenge.expiresAt)<=Date.now()){
    throw new Error('Complete the human check before signing in.');
   }
   const identityType=el('password-identity-type').value;
   const identity=identityType==='phone'?normalizeOtpPhone(el('auth-phone').value):normalizeOtpEmail(el('auth-email').value);
   const sessionResult=await apiRequest('/api/auth/password-login',null,{method:'POST',body:{identityType,identity,password,challengeId:passwordHumanChallenge.challengeId,heldMs:passwordHumanHeldMs}});
   resetPasswordHumanCheck(true);
   const {error}=await client.auth.setSession({access_token:sessionResult.access_token,refresh_token:sessionResult.refresh_token});
   if(error)throw error;
   window.location.assign('/account/?view=overview');return;
  }
 }catch(e){
  notice(e.message||'Something went wrong. Please try again.',true);
  if(authMethod==='password'&&mode==='login')await loadPasswordHumanChallenge(true);
 }
 finally{button.disabled=false;}
}
async function social(provider){
 clearEmailOtpPasswordSetupProof();
 notice('');
 try{const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:profileRedirectUrl()}});if(error)throw error;}
 catch(e){
  notice(explainOAuthError(provider,e),true);
 }
}
async function forgot(){
 const email=el('auth-email').value.trim();if(!email){notice('Enter your email address first.',true);return;}
 try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${redirectUrl()}?reset=1`});if(error)throw error;notice('If the address exists, a password reset email has been sent.');}
 catch(e){notice(e.message,true);}
}
async function reset(event){
 event.preventDefault();
 const password=el('reset-password').value;
 try{
  requirePassword(password);
  const {data,error}=await client.auth.updateUser({password});if(error)throw error;
  const email=data?.user?.email||activeAccountSession?.user?.email||'';
  const {error:signOutError}=await client.auth.signOut();if(signOutError)throw signOutError;
  history.replaceState({},'',location.pathname);hide('password-recovery');hide('dashboard');hide('password-setup');hide('auth-panel',false);
  mode='login';setMode('login');el('password-identity-type').value='email';setMethod('password');if(email)el('auth-email').value=email;
  el('auth-password').value='';el('reset-password').value='';notice('Password updated. Please sign in again with your new password.');
 }catch(e){notice(e.message,true);}
}
async function setInitialOrRenewedPassword(event){
 event.preventDefault();notice('');
 const password=el('setup-password').value,confirm=el('setup-password-confirm').value;
 const currentPassword=el('setup-current-password')?.value||'';
 try{
  requirePassword(password);
  if(password!==confirm)throw new Error('Passwords do not match.');
  const session=await getSession();if(!session)throw new Error('Your verification session expired. Request a new OTP and try again.');
  if(!el('setup-current-password-field')?.classList.contains('hidden')){
   if(!currentPassword)throw new Error('Enter your current password.');
   await verifyCurrentPasswordForSession(session,currentPassword);
  }
  const {error}=await client.auth.updateUser({password});if(error)throw error;
  const updatedSession=await getSession();if(!updatedSession)throw new Error('Password was updated, but your session expired. Sign in again with your new password.');
  const status=await loadPasswordPolicy(updatedSession);
  if(status.mustSetPassword)throw new Error('Supabase accepted the password, but its password-change record was not updated. Confirm that the 20261120 password-policy migration and trigger are installed.');
  const usePhone=Boolean(session.user.phone && String(session.user.email||'').includes('@auth.crakkerxai.com'));
  const email=session.user.email||'';const phone=session.user.phone||'';
  clearEmailOtpPasswordSetupProof();
  const {error:signOutError}=await client.auth.signOut();if(signOutError)throw signOutError;
  hide('password-setup');hide('dashboard');hide('password-security-unavailable');hide('auth-panel',false);
  mode='login';setMode('login');
  el('password-identity-type').value=usePhone?'phone':'email';setMethod('password');
  if(usePhone){el('auth-phone').value=phone;}
  else if(email){el('auth-email').value=email;}
  el('auth-password').value='';el('setup-current-password').value='';
  el('setup-password').value='';el('setup-password-confirm').value='';
  notice('Password saved successfully. Please sign in again using your new password.');
 }
 catch(error){notice(error?.message||'Unable to save your password. Please try again.',true);}
}

function loadCheckout(){
 return new Promise((resolve,reject)=>{
  if(window.Razorpay)return resolve();
  const js=document.createElement('script');js.src='https://checkout.razorpay.com/v1/checkout.js';js.async=true;
  js.onload=()=>window.Razorpay?resolve():reject(new Error('Payment checkout unavailable'));
  js.onerror=()=>reject(new Error('Cannot load Razorpay checkout'));document.head.append(js);
 });
}
async function purchase(){
 if(buying||!pending)return;
 if(!config.paymentsEnabled){notice('Payments are not activated yet. No charge has been made.',true);return;}
 buying=true;let modalOpened=false;el('checkout-btn').disabled=true;notice('');
 try{
  const session=await getSession();if(!session)throw new Error('Sign in again to continue');
  const created=await apiRequest('/api/create-order',session.access_token,{method:'POST',body:{plan:pending}});
  await loadCheckout();
  const checkout=new window.Razorpay({
   key:created.keyId,amount:created.amount,currency:'INR',order_id:created.orderId,
   name:'CrakkerXworld.AI',description:`${PLANS[pending].label} plan · 30-day pass`,
   prefill:{email:session.user.email||'',contact:session.user.phone||''},theme:{color:'#264332'},
   modal:{ondismiss:()=>{buying=false;el('checkout-btn').disabled=!config.paymentsEnabled;}},
   handler:async (payment)=>{
    try{
     const refreshed=await getSession();if(!refreshed)throw new Error('Session expired');
     await apiRequest('/api/verify-payment',refreshed.access_token,{method:'POST',body:payment});
     pending='';history.replaceState({},'',location.pathname);notice('Payment verified. Your 30-day membership is now active.');await render();
    }catch(e){notice('Payment response received, but access could not be confirmed. Do not pay again. Contact support with your payment receipt.',true);}
    finally{buying=false;el('checkout-btn').disabled=!config.paymentsEnabled;}
   }
  });
  checkout.on('payment.failed',()=>notice('Payment failed. No membership was activated.',true));
  checkout.open();modalOpened=true;
 }catch(e){notice(e.message||'Unable to start checkout',true);}
 finally{if(!modalOpened){buying=false;el('checkout-btn').disabled=!config.paymentsEnabled;}}
}

let cxRefreshScrollReady=false;
const DEFAULT_ACCOUNT_PREFERENCES={theme:'dark',font_size:'normal',notifications_security:true,notifications_product:true,notifications_email:true,location_enabled:false,reduced_motion:false};
function normaliseAccountPreferences(value={}){
 const prefs={...DEFAULT_ACCOUNT_PREFERENCES};
 if(value.theme==='dark'||value.theme==='light')prefs.theme=value.theme;
 if(['small','normal','large','extra-large'].includes(value.font_size))prefs.font_size=value.font_size;
 for(const key of ['notifications_security','notifications_product','notifications_email','location_enabled','reduced_motion'])if(typeof value[key]==='boolean')prefs[key]=value[key];
 return prefs;
}
function applyAccountPreferences(prefs){
 const value=normaliseAccountPreferences(prefs);
 document.documentElement.dataset.theme=value.theme;
 document.documentElement.dataset.fontSize=value.font_size;
 document.documentElement.classList.toggle('cx-reduced-motion',value.reduced_motion);
 try{localStorage.setItem('cx_theme',value.theme);}catch{}
 document.dispatchEvent(new CustomEvent('cx:themechange',{detail:{theme:value.theme}}));
}
function populateAccountPreferenceControls(prefs){
 const value=normaliseAccountPreferences(prefs);
 const set=(id,next)=>{const node=el(id);if(node)node.type==='checkbox'?node.checked=Boolean(next):node.value=next;};
 set('pref-theme',value.theme);set('pref-font-size',value.font_size);
 set('pref-notifications-security',value.notifications_security);set('pref-notifications-product',value.notifications_product);set('pref-notifications-email',value.notifications_email);set('pref-location-enabled',value.location_enabled);set('pref-reduced-motion',value.reduced_motion);
}
async function loadAccountPreferences(session){
 const status=el('account-settings-status');
 try{
  const result=await apiRequest('/api/account/preferences',session.access_token);
  accountPreferences=normaliseAccountPreferences(result?.preferences||{});
  populateAccountPreferenceControls(accountPreferences);applyAccountPreferences(accountPreferences);
  if(status)status.textContent='Your saved preferences are loaded.';
 }catch(error){
  accountPreferences=normaliseAccountPreferences({});populateAccountPreferenceControls(accountPreferences);applyAccountPreferences(accountPreferences);
  if(status)status.textContent='Settings could not be loaded from your account. Run the account preferences migration, then refresh.';
  console.warn('Account preferences could not be loaded:',error?.message||error);
 }
}
async function saveAccountPreferences(){
 const button=el('account-settings-save'),status=el('account-settings-status');
 const session=await getSession();if(!session){if(status)status.textContent='Sign in again to save preferences.';return;}
 const value={
  theme:el('pref-theme')?.value||'dark',font_size:el('pref-font-size')?.value||'normal',
  notifications_security:Boolean(el('pref-notifications-security')?.checked),notifications_product:Boolean(el('pref-notifications-product')?.checked),notifications_email:Boolean(el('pref-notifications-email')?.checked),location_enabled:Boolean(el('pref-location-enabled')?.checked),reduced_motion:Boolean(el('pref-reduced-motion')?.checked)
 };
 if(button)button.disabled=true;if(status)status.textContent='Saving your settings…';
 try{
  const result=await apiRequest('/api/account/preferences',session.access_token,{method:'PATCH',body:{preferences:value}});
  accountPreferences=normaliseAccountPreferences(result?.preferences||value);populateAccountPreferenceControls(accountPreferences);applyAccountPreferences(accountPreferences);
  if(status)status.textContent='Preferences saved to your account.';
 }catch(error){
  if(status)status.textContent=error?.message||'Settings could not be saved. Please try again.';
 }finally{if(button)button.disabled=false;}
}
async function saveProfileName(event){
 event?.preventDefault();
 const input=el('profile-display-name'),button=el('profile-name-save'),status=el('profile-name-status');
 const fullName=String(input?.value||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(!fullName){if(status)status.textContent='Enter a display name.';input?.focus();return;}
 if(button)button.disabled=true;if(status)status.textContent='Saving name…';
 try{
  const {data,error}=await client.auth.updateUser({data:{full_name:fullName}});if(error)throw error;
  const saved=String(data?.user?.user_metadata?.full_name||fullName);
  label('profile-name',saved);label('dash-user-name',saved);label('dash-menu-user-name',saved);label('dash-profile-fullname',saved);label('dash-profile-name-detail',saved);
  const initials=saved.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'U';label('dash-avatar',initials);label('dash-profile-avatar',initials);
  if(status)status.textContent='Your profile name has been updated.';
 }catch(error){if(status)status.textContent=error?.message||'Could not update your profile name.';}
 finally{if(button)button.disabled=false;}
}

function initRefreshScrollWidgets(){
 if(cxRefreshScrollReady)return;
 cxRefreshScrollReady=true;
 document.documentElement.classList.add('cx-refresh-scroll-enabled');
 const widget=document.createElement('div');
 widget.className='cx-scroll-widget';
 widget.setAttribute('aria-label','Page controls');
 widget.innerHTML='<button type="button" class="cx-scroll-widget-refresh" aria-label="Refresh page" title="Refresh page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"/></svg></button><button type="button" class="cx-scroll-widget-top" aria-label="Scroll to top" title="Scroll to top"><span class="cx-scroll-widget-top-label">Top</span></button>';
 document.body.append(widget);
 const pull=document.createElement('div');
 pull.className='cx-pull-refresh';
 pull.setAttribute('role','status');
 pull.setAttribute('aria-live','polite');
 pull.innerHTML='<span class="cx-pull-refresh-spinner" aria-hidden="true"></span><span class="cx-pull-refresh-label">Pull to refresh</span>';
 document.body.append(pull);
 const refreshButton=widget.querySelector('.cx-scroll-widget-refresh');
 const topButton=widget.querySelector('.cx-scroll-widget-top');
 const updateScroll=()=>{
  widget.classList.toggle('is-scrolled',window.scrollY>260);
 };
 window.addEventListener('scroll',updateScroll,{passive:true});
 updateScroll();
 refreshButton.addEventListener('click',()=>{
  refreshButton.disabled=true;
  refreshButton.classList.add('is-refreshing');
  refreshButton.setAttribute('aria-label','Refreshing page');
  window.location.reload();
 });
 topButton.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
 let startY=0,startX=0,pulling=false,ready=false;
 document.addEventListener('touchstart',event=>{
  if(window.scrollY>2||event.touches.length!==1){pulling=false;return;}
  startY=event.touches[0].clientY;startX=event.touches[0].clientX;pulling=true;ready=false;
 },{passive:true});
 document.addEventListener('touchmove',event=>{
  if(!pulling||!event.touches.length)return;
  const dy=event.touches[0].clientY-startY;
  const dx=event.touches[0].clientX-startX;
  if(dy<0||Math.abs(dx)>Math.abs(dy)*.85){pulling=false;pull.classList.remove('is-visible','is-ready');return;}
  if(dy<10)return;
  if(event.cancelable)event.preventDefault();
  pull.classList.add('is-visible');
  ready=dy>=76;
  pull.classList.toggle('is-ready',ready);
  pull.querySelector('.cx-pull-refresh-label').textContent=ready?'Release to refresh':'Pull to refresh';
  pull.style.setProperty('--pull-progress',String(Math.min(dy/100,1)));
 },{passive:false});
 const finishPull=()=>{
  if(!pulling)return;
  pulling=false;
  if(ready){
   pull.classList.add('is-refreshing');
   pull.querySelector('.cx-pull-refresh-label').textContent='Refreshing…';
   window.location.reload();
  }else{
   pull.classList.remove('is-visible','is-ready');
   pull.style.removeProperty('--pull-progress');
  }
  ready=false;
 };
 document.addEventListener('touchend',finishPull,{passive:true});
 document.addEventListener('touchcancel',finishPull,{passive:true});
}

export async function initAccount(){
 initRefreshScrollWidgets();
 // Dashboard enhancements are optional; a widget/handler error must not abort auth boot.
 try{initDashboardWorkspace();}
 catch(error){console.error('Dashboard controls could not be initialised:',error);}
 pending=parsePending();
 el('tab-login').addEventListener('click',()=>setMode('login'));
 el('tab-signup').addEventListener('click',()=>setMode('signup'));
 el('auth-form').addEventListener('submit',authAction);
 for(const method of ['email-otp','phone-otp','password'])el('method-'+method).addEventListener('click',()=>{notice('');setMethod(method);});
 el('otp-form').addEventListener('submit',verifyOtp);
 el('otp-resend').addEventListener('click',resendOtp);
 document.querySelectorAll('input[name="phone-otp-channel"]').forEach(input=>input.addEventListener('change',()=>{if(input.checked){selectedPhoneOtpChannel=input.value;el('otp-channel-sms-card')?.classList.toggle('is-selected',input.value==='sms');el('otp-channel-whatsapp-card')?.classList.toggle('is-selected',input.value==='whatsapp');}}));
 el('otp-change').addEventListener('click',()=>{otpContext=null;hide('otp-panel');hide('auth-panel',false);notice('');});
 el('google-login').addEventListener('click',()=>social('google'));
 el('github-login').addEventListener('click',()=>social('github'));
 el('forgot-password').addEventListener('click',forgot);
 el('reset-form').addEventListener('submit',reset);
 el('password-setup-form').addEventListener('submit',setInitialOrRenewedPassword);
 el('password-identity-type').addEventListener('change',()=>setMethod('password'));
 const humanHold=el('password-human-hold');
 if(humanHold){humanHold.addEventListener('pointerdown',beginPasswordHumanHold);humanHold.addEventListener('pointerup',endPasswordHumanHold);humanHold.addEventListener('pointercancel',endPasswordHumanHold);humanHold.addEventListener('keydown',beginPasswordHumanHold);humanHold.addEventListener('keyup',endPasswordHumanHold);humanHold.addEventListener('contextmenu',event=>event.preventDefault());}
 el('account-settings-save')?.addEventListener('click',saveAccountPreferences);
 el('profile-name-form')?.addEventListener('submit',saveProfileName);
 el('identity-send-phone-otp')?.addEventListener('click',requestIdentityPhoneLinkOtp);
 el('identity-verify-phone-otp')?.addEventListener('click',verifyIdentityPhoneLinkOtp);
 el('identity-send-email-link')?.addEventListener('click',requestIdentityEmailLink);
 document.querySelectorAll('input[name="identity-phone-channel"]').forEach(input=>input.addEventListener('change',()=>{if(input.checked){selectedIdentityChannel=input.value;el('identity-channel-sms-card')?.classList.toggle('is-selected',input.value==='sms');el('identity-channel-whatsapp-card')?.classList.toggle('is-selected',input.value==='whatsapp');}}));
 document.querySelectorAll('input[name="identity-email-channel"]').forEach(input=>input.addEventListener('change',()=>{if(input.checked){selectedIdentityEmailChannel=input.value;el('identity-email-channel-sms-card')?.classList.toggle('is-selected',input.value==='sms');el('identity-email-channel-whatsapp-card')?.classList.toggle('is-selected',input.value==='whatsapp');}}));
 el('logout').addEventListener('click',async()=>{clearEmailOtpPasswordSetupProof();await client.auth.signOut();otpContext=null;identityLinkContext=null;notice('Signed out.');await render();});
 el('checkout-btn').addEventListener('click',purchase);
 setMode('login');
 try{
  config=await appConfig();
  refreshPhoneOtpChannels();
  if(!config.authEnabled){
   hide('account-loading');hide('auth-panel',false);
   for(const id of ['auth-submit','google-login','github-login','forgot-password']){const node=el(id);if(node)node.disabled=true;}
   notice('Login and signup are not connected yet. Configure Supabase to enable real accounts. No OTP has been sent.',true);
   return;
  }
  client=await supabaseClient();
  client.auth.onAuthStateChange((event)=>{
   if(event==='PASSWORD_RECOVERY'){showReset();return;}
   if(event==='SIGNED_IN'||event==='SIGNED_OUT')queueMicrotask(()=>render().catch(e=>notice(e.message,true)));
  });
  const recovery=new URLSearchParams(location.search).has('reset');
  if(recovery && await getSession())showReset();else await render();
 }catch(e){
  hide('account-loading');
  // If the shared header already established a valid session, do not expose sign-in UI.
  // Retry session resolution once before treating the visitor as signed out.
  if(!activeAccountSession){
   try{activeAccountSession=await getSession();}catch{}
  }
  if(activeAccountSession?.user){
   hide('auth-panel');hide('otp-panel');hide('dashboard',false);
   if(el('account-heading-title'))el('account-heading-title').innerHTML='Your <span>workspace.</span>';
   if(el('account-heading-subtitle'))el('account-heading-subtitle').textContent='Your account is authenticated. Refresh to reload workspace details.';
   notice('Your session is active, but some workspace details could not be loaded. Please refresh.',true);
   console.error('Authenticated workspace initialisation failed:',e);
   return;
  }
  // Show sign-in choices only when there is no authenticated session.
  hide('auth-panel',false);
  notice('Account setup error. '+(e?.message||'Unable to load account configuration. Check your local environment settings.'),true);
 }
}
