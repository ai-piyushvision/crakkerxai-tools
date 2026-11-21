export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export function formatBytes(bytes){
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${Math.round(bytes/1024)} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}
export function safeName(name){ return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\.+$/g,'').slice(0,120) || 'file'; }
export function baseName(name){ return safeName(name).replace(/\.[^.]+$/,'') || 'file'; }
export function assertFiles(files, type){
  if(!files.length) throw new Error('Choose at least one file.');
  const bytes = files.reduce((n,f)=>n+f.size,0);
  if(bytes>MAX_TOTAL_BYTES) throw new Error('Selected files exceed the 50 MB total limit. Please choose fewer or smaller files.');
  for (const f of files){
    const ext = f.name.toLowerCase().split('.').pop();
    if (type === 'pdf' && !(ext==='pdf' || f.type==='application/pdf')) throw new Error(`${f.name} is not a PDF file.`);
    if (type === 'image' && !['jpg','jpeg','png','webp'].includes(ext) && !['image/jpeg','image/png','image/webp'].includes(f.type)) throw new Error(`${f.name} is not a supported image.`);
  }
}
export function parsePageRanges(text, pageCount){
  if(!Number.isSafeInteger(pageCount)||pageCount<1) throw new Error('The PDF contains no pages.');
  const input=String(text||'').trim();
  if(!input || /^all$/i.test(input)) return Array.from({length:pageCount},(_,i)=>i);
  const out=[];
  for(const entry of input.split(',')){
    const part=entry.trim();
    const single=/^(\d+)$/.exec(part), range=/^(\d+)\s*-\s*(\d+)$/.exec(part);
    if(!single&&!range) throw new Error('Enter pages like 1,3,5-7 or "all".');
    const a=Number(single?single[1]:range[1]); const b=Number(single?single[1]:range[2]);
    if(a<1||b<a||b>pageCount) throw new Error(`Page range must be between 1 and ${pageCount}, in ascending order.`);
    for(let i=a;i<=b;i++) if(!out.includes(i-1)) out.push(i-1);
  }
  if(!out.length) throw new Error('No pages selected.');
  return out;
}
export function clampSize(value, label='Size'){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1||n>12000) throw new Error(`${label} must be a whole number from 1 to 12000.`);
  return n;
}
export function outputName(file, ext){ return `${baseName(file.name)}.${ext}`; }
