

function initResponsiveNavigation(){
  const toggle=document.querySelector('[data-mobile-nav-toggle]');
  const nav=document.querySelector('#primary-navigation');
  const services=document.querySelector('.nav-services');
  const servicesToggle=document.querySelector('[data-services-toggle]');
  const conversion=document.querySelector('.services-subgroup');
  const conversionToggle=document.querySelector('[data-conversion-toggle]');
  const close=()=>{toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation');nav?.classList.remove('is-mobile-open');services?.classList.remove('is-open');servicesToggle?.setAttribute('aria-expanded','false');conversion?.classList.remove('is-open');conversionToggle?.setAttribute('aria-expanded','false');};
  toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav?.classList.toggle('is-mobile-open',open);});
  servicesToggle?.addEventListener('click',()=>{const open=servicesToggle.getAttribute('aria-expanded')!=='true';servicesToggle.setAttribute('aria-expanded',String(open));services?.classList.toggle('is-open',open);if(!open){conversion?.classList.remove('is-open');conversionToggle?.setAttribute('aria-expanded','false');}});
  conversionToggle?.addEventListener('click',()=>{const open=conversionToggle.getAttribute('aria-expanded')!=='true';conversionToggle.setAttribute('aria-expanded',String(open));conversion?.classList.toggle('is-open',open);});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.addEventListener('click',e=>{if(!e.target.closest('.site-header'))close();});
  window.addEventListener('resize',()=>{if(window.innerWidth>780)close();},{passive:true});
  const header=document.querySelector('.site-header');
  const sync=()=>header?.classList.toggle('is-scrolled',window.scrollY>12);
  window.addEventListener('scroll',sync,{passive:true});sync();
}
function initScrollReveal(){
  const candidates=document.querySelectorAll('main section, .tool-card, .membership-card, .ai-topic-grid article, .feedback-form, .tool-panel');
  if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  candidates.forEach((el,index)=>{if(el.closest('.dashboard'))return;el.classList.add('reveal-on-scroll');el.style.transitionDelay=`${Math.min(index%4,3)*55}ms`;});
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-in-view');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -35px 0px'});
  candidates.forEach(el=>{if(el.classList.contains('reveal-on-scroll'))observer.observe(el);});
}

function initWorkspaceUtilities(){
  if(document.querySelector('[data-cx-float]'))return;
  const root=document.createElement('div');root.className='cx-float-tools';root.setAttribute('data-cx-float','');
  root.innerHTML='<button type="button" class="cx-float-top" aria-label="Scroll to top" title="Scroll to top">Top</button><a class="cx-float-help" href="/feedback/" aria-label="Help and support" title="Help and support">?</a>';
  document.body.append(root);
  const top=root.querySelector('.cx-float-top');
  const sync=()=>{root.classList.toggle('is-visible',window.scrollY>360)};
  window.addEventListener('scroll',sync,{passive:true});sync();
  top.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  // Keyboard shortcut: Ctrl/Cmd+K focuses the visible tool search.
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      const search=document.querySelector('#dash-search, #tool-search, [data-tool-search]');
      if(search){event.preventDefault();search.focus();}
    }
  });
}
function recordConversionActivity({tool,name,size}){
  try{
    const key='cx_conversion_activity_v1';
    const rows=JSON.parse(localStorage.getItem(key)||'[]');
    rows.unshift({tool:String(tool||'File tool'),name:String(name||'Processed file').slice(0,100),size:Number(size)||0,at:new Date().toISOString()});
    localStorage.setItem(key,JSON.stringify(rows.slice(0,40)));
  }catch(error){console.warn('Could not store local conversion activity',error);}
}


function initTheme(){
  const button=document.querySelector('[data-theme-toggle]');
  const root=document.documentElement;
  let theme='dark';
  try{theme=localStorage.getItem('cx_theme')||'dark'}catch{}
  const apply=()=>{
    root.dataset.theme=theme;
    if(button){
      const nextLabel=theme==='dark'?'Morning Mode':'Night Mode';
      button.setAttribute('aria-label',`Switch to ${nextLabel}`);
      button.setAttribute('title',`Switch to ${nextLabel}`);
      const icon=button.querySelector('[data-theme-icon]');if(icon)icon.textContent=theme==='dark'?'🌅':'🌙';
      const label=button.querySelector('[data-theme-label]');if(label)label.textContent=nextLabel;
    }
  };
  apply();
  document.addEventListener('cx:themechange',event=>{const next=event.detail?.theme;if(next==='dark'||next==='light'){theme=next;apply();}});
  button?.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('cx_theme',theme)}catch{}apply()});
}

function initAiUpdatesFeed(){
  const root=document.querySelector('[data-ai-updates]');if(!root)return;
  const list=root.querySelector('[data-ai-story-list]');const status=root.querySelector('[data-ai-feed-status]');
  const refresh=root.querySelector('[data-ai-refresh]');const sourceList=root.querySelector('[data-ai-source-list]');
  const count=root.querySelector('[data-ai-story-count]');const sourceCount=root.querySelector('[data-ai-source-count]');
  const checked=root.querySelector('[data-ai-last-checked]');const filters=[...root.querySelectorAll('[data-ai-filter]')];
  let stories=[];let active='All';let busy=false;
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const formatDate=value=>{if(!value)return 'Date not supplied by publisher';const date=new Date(value);return Number.isNaN(date.getTime())?'Date not supplied by publisher':new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'}).format(date);};
  const render=()=>{
    list.replaceChildren();const visible=active==='All'?stories:stories.filter(item=>item.category===active|| (active==='Python'&&/python/i.test(`${item.title} ${item.description} ${item.source}`)));
    if(!visible.length){list.append(el('div','ai-empty-state',stories.length?'No announcements in this category yet. Try another filter.':'No publisher updates are available right now. Please refresh in a few minutes.'));return;}
    visible.forEach((item,index)=>{
      const card=el('article','ai-story-card');const meta=el('div','ai-story-meta');
      meta.append(el('span','ai-story-category',item.category||'Technology'),el('span','ai-meta-dot','•'),el('span','ai-story-source',item.source||'Publisher'),el('span','ai-meta-dot','•'),el('time','ai-story-date',formatDate(item.published_at)));
      const title=el('h3','ai-story-title',item.title);const desc=el('p','ai-story-description',item.description||'Open the original announcement for full technical details.');
      const bottom=el('div','ai-story-bottom');const badges=el('div','ai-version-badges');
      (item.versions||[]).forEach(version=>badges.append(el('span','ai-version-chip',`v${version}`)));
      if(!(item.versions||[]).length)badges.append(el('span','ai-no-version','Version not specified by publisher'));
      const link=el('a','ai-read-link','Read original announcement ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
      bottom.append(badges,link);card.append(meta,title,desc,bottom);list.append(card);
    });
  };
  const renderSources=sources=>{
    sourceList.replaceChildren();(sources||[]).forEach(source=>{const row=el('a','ai-source-row');row.href=source.url;row.target='_blank';row.rel='noopener noreferrer';const left=el('span','ai-source-name',source.name);const right=el('span',`ai-source-state ${source.status==='available'?'is-live':'is-down'}`,source.status==='available'?'Live':'Unavailable');row.append(left,right);sourceList.append(row);});
    if(!sources?.length)sourceList.append(el('span','ai-source-loading','Source status unavailable.'));
  };
  const load=async(force=false)=>{
    if(busy)return;busy=true;refresh.disabled=true;refresh.classList.add('is-loading');
    const oldLabel=refresh.textContent;refresh.textContent='Refreshing…';if(!stories.length)status.textContent='Connecting to official publisher feeds…';
    try{
      const response=await fetch(`/api/ai/updates?limit=60${force?'&refresh=1':''}`,{headers:{Accept:'application/json'},cache:force?'no-store':'default'});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||data.error||`Feed request failed (${response.status}).`);
      stories=Array.isArray(data.stories)?data.stories:[];count.textContent=String(stories.length);sourceCount.textContent=`${data.available_sources??0}/${data.total_sources??0}`;
      checked.textContent=data.last_checked?new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'}).format(new Date(data.last_checked)):'—';
      status.textContent=`${stories.length} announcements · ${data.available_sources??0} of ${data.total_sources??0} publisher feeds responding · refreshed ${formatDate(data.last_checked)}`;
      renderSources(data.sources);render();
    }catch(error){
      status.textContent=`Live feed is temporarily unavailable: ${error.message} Check that the Python API is running and reachable.`;
      if(!stories.length){list.replaceChildren();const fallback=el('div','ai-feed-fallback');fallback.append(el('strong','','Publisher feeds are temporarily unreachable.'),el('p','','You can still visit the official release channels below while the live feed reconnects.'));const sources=[['Python.org','https://blog.python.org/'],['AWS Machine Learning','https://aws.amazon.com/blogs/machine-learning/'],['Microsoft Azure','https://azure.microsoft.com/en-us/blog/topics/ai/'],['Hugging Face','https://huggingface.co/blog'],['PyTorch','https://pytorch.org/blog/'],['OpenAI','https://openai.com/news/']];sources.forEach(([name,url])=>{const a=el('a','ai-read-link',`${name} ↗`);a.href=url;a.target='_blank';a.rel='noopener noreferrer';fallback.append(a);});list.append(fallback);}
    }finally{busy=false;refresh.disabled=false;refresh.classList.remove('is-loading');refresh.innerHTML='<span aria-hidden="true">↻</span> Refresh feed';}
  };
  filters.forEach(button=>button.addEventListener('click',()=>{active=button.dataset.aiFilter;filters.forEach(item=>item.classList.toggle('active',item===button));render();}));
  refresh?.addEventListener('click',()=>load(true));load();
}

function initFeedbackForm(){
  const form=document.getElementById('feedback-form');if(!form)return;
  const status=document.getElementById('feedback-status');const submit=form.querySelector('[type="submit"]');
  const show=(message,error=false)=>{status.textContent=message;status.classList.remove('hidden','is-error','is-success');status.classList.add(error?'is-error':'is-success')};
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form).entries());
    data.consent=Boolean(form.querySelector('[name="consent"]')?.checked);
    data.page_url=data.page_url||'';
    submit.disabled=true;submit.textContent='Sending securely…';status.classList.add('hidden');
    try{
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'We could not submit your feedback. Please try again.');
      form.reset();show(`Thank you. Your ${data.category==='bug'?'bug report':data.category==='feature'?'feature request':'message'} has been received. Reference: ${result.reference||'submitted'}. Our team can follow up using your contact details.`);
    }catch(error){show(error.message||'Network error. Please try again later.',true)}
    finally{submit.disabled=false;submit.innerHTML='Send feedback <span aria-hidden="true">→</span>'}
  });
}

import {appConfig,getSession,apiRequest} from './auth-client.js';
import {initAccountMenu} from './account-menu.js';
import {getPlan} from './plans.mjs';
import {initAdvertising,adsPermitted} from './ad-access.js';
import {formatBytes,assertFiles} from './utils.mjs';
import {handlers as browserConverters} from './converters.js';
import {initBrowserGestureGuard} from './browser-gesture-guard.js';

const $=(id)=>document.getElementById(id);
const type=document.body?.dataset.tool || '';
const downloadIcon='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v3h14v-3"/></svg>';
const arrowIcon=(dir)=>`<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${dir==='up'?'m6 15 6-6 6 6':'m6 9 6 6 6-6'}"/></svg>`;
const trashIcon='<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6"/></svg>';

function initCatalog(){
  const query=$('tool-search');if(!query)return;
  const buttons=[...document.querySelectorAll('[data-filter]')];
  const grid=$('tool-grid');
  const cards=[...document.querySelectorAll('.tool-card')];
  const status=$('search-status');
  let filter='all', requestId=0;
  const aliases={
    'images-to-pdf':['image to pdf','jpg to pdf','jpeg to pdf','png to pdf','photo to pdf','pictures to pdf'],
    'pdf-to-png':['pdf to image','pdf to jpg','pdf converter','convert pdf pages'],
    'merge-pdf':['combine pdf','join pdf','pdf merger','merge documents'],
    'extract-pdf-pages':['split pdf','pdf splitter','extract pages','remove pdf pages'],
    'rotate-pdf':['rotate pages','pdf rotation','change pdf orientation'],
    'convert-image':['image converter','png to jpg','jpg to png','webp converter','change image format'],
    'resize-image':['image resizer','photo resizer','change image size'],
    'compress-image':['image compressor','reduce image size','make image smaller','optimize image']
  };
  const localRank=(text)=>{
    const q=text.toLowerCase().trim();
    return cards.map(card=>{
      const slug=card.getAttribute('href').split('/').filter(Boolean).pop();
      const hay=(card.textContent+' '+(aliases[slug]||[]).join(' ')).toLowerCase();
      let score=0;
      if(!q)score=1;
      else if(hay.includes(q))score=1;
      else for(const token of q.split(/\s+/)){if(token.length>2&&hay.includes(token))score+=0.3;}
      return {card,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  };
  const render=(ranked,text)=>{
    let visible=0;
    const ordered=ranked.map(x=>x.card);
    for(const card of cards){
      const item=ranked.find(x=>x.card===card);
      const show=Boolean(item)&&(filter==='all'||card.dataset.cat===filter);
      card.hidden=!show;
      if(show){visible++;card.style.order=String(ordered.indexOf(card));}
    }
    $('no-results')?.classList.toggle('hidden',visible!==0);
    if(status)status.textContent=text&&visible?`${visible} matching tool${visible===1?'':'s'} found.`:'';
  };
  const search=async()=>{
    const text=query.value.trim();
    if(!text){render(cards.map(card=>({card,score:1})), '');return;}
    const local=localRank(text);
    render(local,'');
    const id=++requestId;
    try{
      const response=await fetch(`/api/search?q=${encodeURIComponent(text)}&limit=8`,{headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Python search API unavailable');
      const data=await response.json();
      if(id!==requestId||query.value.trim()!==text)return;
      const rank=new Map((data.results||[]).map((item,index)=>[item.slug,index]));
      const apiRank=cards.map(card=>({card,score:rank.has(card.getAttribute('href').split('/').filter(Boolean).pop())?100-rank.get(card.getAttribute('href').split('/').filter(Boolean).pop()):-1})).filter(x=>x.score>=0);
      if(apiRank.length)render(apiRank,`Python ${data.mode||'ML'} search · ${apiRank.length} result${apiRank.length===1?'':'s'}`);
    }catch{
      if(id===requestId&&status)status.textContent=local.length?`${local.length} local matches · Python search API not connected yet.`:'No matching tool found.';
    }
  };
  buttons.forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;buttons.forEach(x=>x.classList.toggle('active',x===b));search();}));
  query.addEventListener('input',search);
  query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search();const first=cards.find(card=>!card.hidden);if(first)window.location.href=first.href;}});
  render(cards.map(card=>({card,score:1})), '');
}

function initConverter(){
  const input=$('file-input');if(!input)return;
  const choose=$('choose-file'),zone=$('drop-zone'), list=$('file-list'), run=$('run-btn');
  const err=$('error'),progress=$('progress'),resultBox=$('result'),download=$('download-link');
  let files=[], url=null, busy=false, adRequested=false;
  const isImage=!['pdf-to-png','merge-pdf','extract-pdf-pages','rotate-pdf'].includes(type);
  const requiresMultiple=type==='merge-pdf';
  const auto=type==='images-to-pdf';
  if(auto)run.classList.add('hidden'); // Original one-step experience: image selection produces the download immediately.
  const setError=(message)=>{err.textContent=message||'';err.classList.toggle('hidden',!message);};
  const setProgress=(message)=>{progress.textContent=message||'';};
  const clearResult=()=>{resultBox.classList.add('hidden');if(url){URL.revokeObjectURL(url);url=null;}download.removeAttribute('href');};
  const setBusy=(active)=>{
    busy=active; choose.disabled=active;input.disabled=active;
    run.disabled=active || !files.length || (requiresMultiple && files.length<2);
    run.classList.toggle('loading',active);
    list.querySelectorAll('button').forEach(b=>b.disabled=active);
  };
  const drawList=()=>{
    list.replaceChildren();
    files.forEach((file,index)=>{
      const row=document.createElement('div');row.className='file-row';
      const details=document.createElement('div');details.className='file-details';
      const name=document.createElement('span');name.className='file-name';name.textContent=`${index+1}. ${file.name}`;
      const size=document.createElement('small');size.textContent=formatBytes(file.size);
      details.append(name,size);row.append(details);
      const actions=document.createElement('div');actions.className='file-actions';
      const action=(title,icon,handler,disabled=false)=>{
        const b=document.createElement('button');b.type='button';b.className='icon-button';b.setAttribute('aria-label',title);b.title=title;b.innerHTML=icon;b.disabled=disabled||busy;b.addEventListener('click',handler);actions.append(b);
      };
      if(files.length>1 && (type==='images-to-pdf'||type==='merge-pdf')){
        action(`Move ${file.name} up`,arrowIcon('up'),()=>move(index,-1),index===0);
        action(`Move ${file.name} down`,arrowIcon('down'),()=>move(index,1),index===files.length-1);
      }
      action(`Remove ${file.name}`,trashIcon,()=>{
        if(busy)return;files.splice(index,1);clearResult();setProgress('');setError('');drawList();setBusy(false);if(auto&&files.length)process();
      });
      row.append(actions);list.append(row);
    });
    setBusy(busy);
  };
  const move=(index,offset)=>{
    if(busy)return;const next=index+offset;if(next<0||next>=files.length)return;
    [files[index],files[next]]=[files[next],files[index]];
    clearResult();setProgress('');setError('');drawList();if(auto)process();
  };
  const select=(selected)=>{
    if(busy)return;
    const incoming=Array.from(selected);
    if(!incoming.length)return;
    const next=input.multiple?incoming:incoming.slice(0,1);
    try {assertFiles(next,isImage?'image':'pdf');}
    catch(e){setError(e.message);return;}
    files=next;clearResult();setError('');setProgress('');drawList();
    if(auto)process();
  };
  choose.addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{select(input.files);input.value='';});
  for(const name of ['dragenter','dragover'])zone.addEventListener(name,e=>{e.preventDefault();zone.classList.add('dragover');});
  for(const name of ['dragleave','drop'])zone.addEventListener(name,e=>{e.preventDefault();zone.classList.remove('dragover');});
  zone.addEventListener('drop',e=>{if(!busy)select(e.dataTransfer.files);});
  const quality=$('quality');if(quality)quality.addEventListener('input',()=>{$('quality-label').textContent=`${quality.value}%`;});
  const aspect=$('lockAspect');if(aspect)aspect.addEventListener('change',()=>{$('height').disabled=aspect.checked;});
  const opts=()=>({
    scale:Number($('scale')?.value||1.5),pages:type==='pdf-to-png'?([...document.querySelectorAll('input[name="export-pages"]')].find(x=>x.checked)?.value==='single'?String($('single-page-number')?.value||'1'):'all'):($('pages')?.value||''),outputFormat:$('export-format')?.value||'png',includeOriginalPdf:$('include-original-pdf')?.checked||false,
    angle:Number($('angle')?.value||90),format:$('format')?.value||'webp',
    quality:Number(quality?.value||85)/100,width:$('width')?.value||1200,
    height:$('height')?.value||800,lockAspect:aspect?.checked??true,
    maxDimension:$('maxDimension')?.value||''
  });
  const getLimits=async()=>{
    const config=await appConfig();
    if(!config.paymentsEnabled)return {enforced:false,plan:getPlan('free'),session:null};
    const session=await getSession().catch(()=>null);
    if(!session)return {enforced:true,plan:getPlan('free'),session:null};
    const info=await apiRequest('/api/me',session.access_token);
    return {enforced:true,plan:getPlan(info.plan),session};
  };
  const checkFileLimits=(policy)=>{
    if(!policy.enforced)return;
    const {plan}=policy;
    if(plan.batch!==null&&files.length>plan.batch)throw new Error(`${plan.label}: maximum ${plan.batch} files per batch. Choose a plan at /pricing/.`);
    const total=files.reduce((sum,file)=>sum+file.size,0);
    if(total>plan.maxMB*1024*1024)throw new Error(`${plan.label}: maximum ${plan.maxMB} MB total input per conversion.`);
  };
  const consumeUsage=async(policy)=>{
    if(!policy.enforced||policy.plan.daily===null)return;
    if(policy.session){
      await apiRequest('/api/use-quota',policy.session.access_token,{method:'POST'});
      return;
    }
    // Guest limits are convenience limits only. They are not a fraud-resistant boundary.
    const key=`cx_guest_conversions_${new Date().toISOString().slice(0,10)}`;
    let count=0;try{count=Number(localStorage.getItem(key)||0)}catch{}
    if(count>=policy.plan.daily)throw new Error(`Free plan daily limit reached (${policy.plan.daily}). Sign in for paid plans.`);
    try{localStorage.setItem(key,String(count+1))}catch{}
  };
  const mountAd=async()=>{
    if(!await adsPermitted())return;
    if(adRequested)return;
    // Set the numeric slot using VITE_ADSENSE_SLOT_ID after creating a display ad unit in AdSense.
    const slot=import.meta.env.VITE_ADSENSE_SLOT_ID;
    if(!/^\d{5,20}$/.test(slot||''))return;
    adRequested=true;
    const wrapper=$('ad-container');
    const ins=document.createElement('ins');ins.className='adsbygoogle';ins.style.display='block';
    ins.setAttribute('data-ad-client','ca-pub-8574777140654469');
    ins.setAttribute('data-ad-slot',slot);ins.setAttribute('data-ad-format','auto');
    ins.setAttribute('data-full-width-responsive','true');wrapper.append(ins);
    $('result-ad').classList.remove('hidden');
    try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}
    catch(e){console.warn('AdSense will render when eligible:',e);}
  };
  async function process(){
    if(busy)return;
    setError('');clearResult();
    try{assertFiles(files,isImage?'image':'pdf');if(requiresMultiple&&files.length<2)throw new Error('Choose at least two PDF files.');}
    catch(e){setError(e.message);return;}
    setBusy(true);setProgress('Preparing files…');
    try{
      const policy=await getLimits();checkFileLimits(policy);
      const converter=browserConverters[type];
      if(typeof converter!=='function')throw new Error('This conversion tool is not available in this release. Please contact support.');
      setProgress('Processing locally in your browser. Your files are not uploaded…');
      const converted=await converter(files,opts(),setProgress);
      const outputBlob=converted?.blob;
      if(!(outputBlob instanceof Blob)||outputBlob.size===0)throw new Error('The browser conversion returned an empty file. Please try a different file.');
      const outputName=String(converted.name||`${type}-result.${outputBlob.type==='application/zip'?'zip':'pdf'}`);
      await consumeUsage(policy);
      url=URL.createObjectURL(outputBlob);download.href=url;download.download=outputName;
      $('download-label').textContent=`Download ${outputName}`;
      $('result-status').textContent=`Ready! ${formatBytes(outputBlob.size)} · Processed privately in your browser.`;
      resultBox.classList.remove('hidden');setProgress('');
      recordConversionActivity({tool:type,name:outputName,size:outputBlob.size});
      void mountAd();
    }catch(e){setProgress('');setError(e?.message||'Conversion failed. Please try a smaller or different file.');}
    finally{setBusy(false);drawList();}
  }
  const exportModal=$('pdf-export-modal');
  const closeExportModal=()=>{if(!exportModal)return;exportModal.classList.add('hidden');exportModal.setAttribute('aria-hidden','true');};
  if(exportModal){
    exportModal.querySelectorAll('[data-modal-close]').forEach(button=>button.addEventListener('click',closeExportModal));
    const pageRadios=[...exportModal.querySelectorAll('input[name="export-pages"]')];
    pageRadios.forEach(radio=>radio.addEventListener('change',()=>{
      $('single-page-field')?.classList.toggle('hidden',radio.value!=='single'||!radio.checked);
    }));
    $('confirm-pdf-export')?.addEventListener('click',()=>{
      const selected=pageRadios.find(radio=>radio.checked)?.value||'all';
      const pageNumber=Number($('single-page-number')?.value||1);
      if(selected==='single'&&(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>120)){
        setError('Enter a valid page number between 1 and 120.');closeExportModal();return;
      }
      closeExportModal();process();
    });
  }
  run.addEventListener('click',()=>{
    if(type==='pdf-to-png'&&exportModal){
      setError('');setProgress('');exportModal.classList.remove('hidden');exportModal.setAttribute('aria-hidden','false');
      exportModal.querySelector('.modal-card')?.focus();
    }else process();
  });
  window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
  setBusy(false);
}
initBrowserGestureGuard();initTheme();initResponsiveNavigation();initScrollReveal();initWorkspaceUtilities();initFeedbackForm();initAiUpdatesFeed();
initCatalog();initConverter();
void initAccountMenu();
void initAdvertising();
if(document.getElementById('plan-cards'))import('./pricing-page.js').then(m=>m.initPricing());
if(document.getElementById('auth-panel'))import('./account-page.js').then(m=>m.initAccount());
