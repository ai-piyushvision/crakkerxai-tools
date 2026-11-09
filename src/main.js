import './styles.css';
import {formatBytes,assertFiles} from './utils.mjs';

const $=(id)=>document.getElementById(id);
const type=document.body?.dataset.tool || '';
const downloadIcon='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v3h14v-3"/></svg>';
const arrowIcon=(dir)=>`<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${dir==='up'?'m6 15 6-6 6 6':'m6 9 6 6 6-6'}"/></svg>`;
const trashIcon='<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6"/></svg>';

function initCatalog(){
  const query=$('tool-search');if(!query)return;
  const buttons=[...document.querySelectorAll('[data-filter]')];let filter='all';
  const refresh=()=>{
    const text=query.value.toLowerCase().trim();let visible=0;
    for(const card of document.querySelectorAll('.tool-card')){
      const show=(filter==='all'||card.dataset.cat===filter) && (!text||card.textContent.toLowerCase().includes(text));
      card.hidden=!show;if(show)visible++;
    }
    $('no-results')?.classList.toggle('hidden',visible!==0);
  };
  buttons.forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;buttons.forEach(x=>x.classList.toggle('active',x===b));refresh();}));
  query.addEventListener('input',refresh);
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
    scale:Number($('scale')?.value||1.5),pages:$('pages')?.value||'',
    angle:Number($('angle')?.value||90),format:$('format')?.value||'webp',
    quality:Number(quality?.value||85)/100,width:$('width')?.value||1200,
    height:$('height')?.value||800,lockAspect:aspect?.checked??true,
    maxDimension:$('maxDimension')?.value||''
  });
  const mountAd=()=>{
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
      const {handlers}=await import('./converters.js');
      const output=await handlers[type]([...files],opts(),setProgress);
      if(!output?.blob||output.blob.size===0)throw new Error('The conversion did not produce a valid file.');
      url=URL.createObjectURL(output.blob);download.href=url;download.download=output.name;
      $('download-label').textContent=`Download ${output.name}`;
      $('result-status').textContent=`Ready! ${formatBytes(output.bytes)} · Your file stays on your device.`;
      resultBox.classList.remove('hidden');setProgress('');
      mountAd();
    }catch(e){setProgress('');setError(e?.message||'Conversion failed. Please try a smaller or different file.');}
    finally{setBusy(false);drawList();}
  }
  run.addEventListener('click',process);
  window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
  setBusy(false);
}
initCatalog();initConverter();
