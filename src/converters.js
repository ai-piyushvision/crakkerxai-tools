import { parsePageRanges, clampSize, baseName, outputName, assertFiles } from './utils.mjs';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const report = (onProgress, message) => { if (typeof onProgress === 'function') onProgress(message); };
const result = (blob, name) => ({blob, name, bytes:blob.size});

async function pdfLib(){ return import('pdf-lib'); }
async function loadPDF(file){
  const {PDFDocument} = await pdfLib();
  try { return await PDFDocument.load(await file.arrayBuffer(), {updateMetadata:false}); }
  catch (e) { throw new Error(`Could not open “${file.name}”. It may be damaged or password-protected. ${e.message||''}`); }
}
async function packFiles(parts, zipName, onProgress){
  if(parts.length===1) return result(parts[0].blob,parts[0].name);
  const {default:JSZip}=await import('jszip');
  const zip=new JSZip();
  const counts=new Map();
  for(const p of parts){
    const n=counts.get(p.name)||0; counts.set(p.name,n+1);
    const unique=n ? p.name.replace(/(\.[^.]*)?$/,`-${n+1}$1`) : p.name;
    zip.file(unique,p.blob);
  }
  report(onProgress,'Packaging files into a ZIP…');
  return result(await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}), zipName);
}
async function decodeImage(file){
  try {
    if('createImageBitmap' in window){
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      return {image:bitmap, width:bitmap.width,height:bitmap.height,cleanup:()=>bitmap.close()};
    }
  } catch { /* fall back to image element */ }
  const url=URL.createObjectURL(file);
  try {
    const image=await new Promise((resolve,reject)=>{
      const im=new Image(); im.onload=()=>resolve(im); im.onerror=()=>reject(new Error(`Cannot decode image: ${file.name}`)); im.src=url;
    });
    return {image,width:image.naturalWidth,height:image.naturalHeight,cleanup:()=>URL.revokeObjectURL(url)};
  } catch(e){URL.revokeObjectURL(url); throw e;}
}
function makeCanvas(decoded,width=decoded.width,height=decoded.height,opaque=false){
  if(width*height>30_000_000 || width>12000 || height>12000) throw new Error('Image dimensions are too large for safe browser processing. Try a smaller image.');
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:!opaque});
  if(!ctx) throw new Error('Your browser could not create an image canvas.');
  if(opaque){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);}
  ctx.imageSmoothingQuality='high'; ctx.drawImage(decoded.image,0,0,width,height);
  return canvas;
}
async function canvasBlob(canvas,mime,quality){
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Your browser could not encode this image.')),mime,quality));
  if(blob.type && blob.type!==mime) throw new Error(`This browser does not support ${mime} image output.`);
  canvas.width=0;canvas.height=0;
  return blob;
}
function ensureImageFiles(files){assertFiles(files,'image');}
function ensurePDFiles(files){assertFiles(files,'pdf');}

export async function imagesToPdf(files,_,onProgress){
  ensureImageFiles(files);
  const {PDFDocument}=await pdfLib(); const doc=await PDFDocument.create();
  for(let i=0;i<files.length;i++){
    const file=files[i]; report(onProgress,`Adding image ${i+1} of ${files.length}…`);
    const decoded=await decodeImage(file);
    try{
      let image;
      try {
        const bytes=await file.arrayBuffer();
        if(file.type==='image/jpeg'||/\.jpe?g$/i.test(file.name)) image=await doc.embedJpg(bytes);
        else if(file.type==='image/png'||/\.png$/i.test(file.name)) image=await doc.embedPng(bytes);
      } catch { image=undefined; }
      if(!image){
        const canvas=makeCanvas(decoded);
        const png=await canvasBlob(canvas,'image/png');
        image=await doc.embedPng(await png.arrayBuffer());
      }
      const factor=Math.min(0.75,14400/image.width,14400/image.height);
      const w=image.width*factor, h=image.height*factor;
      const page=doc.addPage([w,h]); page.drawImage(image,{x:0,y:0,width:w,height:h});
    } finally {decoded.cleanup();}
    await tick();
  }
  report(onProgress,'Finishing your PDF…');
  return result(new Blob([await doc.save()],{type:'application/pdf'}),'images.pdf');
}

export async function pdfToPng(files,options,onProgress){
  ensurePDFiles(files);
  const [pdfjs,worker]=await Promise.all([
    import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const task=pdfjs.getDocument({data:new Uint8Array(await files[0].arrayBuffer()),useSystemFonts:true});
  const parts=[];let pdf;
  try{
    pdf=await task.promise;
    if(pdf.numPages>120) throw new Error('This browser tool supports up to 120 PDF pages per conversion. Split a larger PDF first.');
    const scale=Number(options.scale)||1.5;
    for(let i=1;i<=pdf.numPages;i++){
      report(onProgress,`Rendering page ${i} of ${pdf.numPages}…`);
      const page=await pdf.getPage(i); let viewport=page.getViewport({scale});
      const safeScale=Math.min(1, 5000/Math.max(viewport.width,viewport.height),Math.sqrt(20_000_000/(viewport.width*viewport.height)));
      if(safeScale<1) viewport=page.getViewport({scale:scale*safeScale});
      const canvas=document.createElement('canvas'); canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      try{
        const context=canvas.getContext('2d',{alpha:false});
        if(!context) throw new Error('Canvas is unavailable.');
        context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
        await page.render({canvasContext:context,viewport,canvas}).promise;
        parts.push({blob:await canvasBlob(canvas,'image/png'),name:`page-${String(i).padStart(3,'0')}.png`});
      }finally{canvas.width=0;canvas.height=0;page.cleanup();}
      await tick();
    }
  }finally{if(pdf) await pdf.destroy();else await task.destroy();}
  return packFiles(parts,`${baseName(files[0].name)}-png.zip`,onProgress);
}

export async function mergePdf(files,_,onProgress){
  ensurePDFiles(files);
  if(files.length<2) throw new Error('Choose two or more PDFs to merge.');
  const {PDFDocument}=await pdfLib(); const merged=await PDFDocument.create();
  for(let i=0;i<files.length;i++){
    report(onProgress,`Merging PDF ${i+1} of ${files.length}…`);
    const pdf=await loadPDF(files[i]);
    const pages=await merged.copyPages(pdf,pdf.getPageIndices());
    pages.forEach(p=>merged.addPage(p));await tick();
  }
  return result(new Blob([await merged.save()],{type:'application/pdf'}),'merged.pdf');
}

export async function extractPdfPages(files,options,onProgress){
  ensurePDFiles(files);
  report(onProgress,'Reading PDF pages…');
  const {PDFDocument}=await pdfLib(); const source=await loadPDF(files[0]);
  const nums=parsePageRanges(options.pages,source.getPageCount());
  const target=await PDFDocument.create();
  const copied=await target.copyPages(source,nums);copied.forEach(p=>target.addPage(p));
  report(onProgress,`Extracting ${nums.length} pages…`);
  return result(new Blob([await target.save()],{type:'application/pdf'}),`${baseName(files[0].name)}-extracted.pdf`);
}

export async function rotatePdf(files,options,onProgress){
  ensurePDFiles(files);
  const {degrees}=await pdfLib(); const pdf=await loadPDF(files[0]);
  const pages=parsePageRanges(options.pages,pdf.getPageCount());
  const angle=Number(options.angle);
  if(![90,180,270].includes(angle)) throw new Error('Choose a rotation of 90°, 180° or 270°.');
  for(const i of pages){const page=pdf.getPage(i);page.setRotation(degrees((page.getRotation().angle+angle)%360));}
  report(onProgress,`Rotated ${pages.length} pages…`);
  return result(new Blob([await pdf.save()],{type:'application/pdf'}),`${baseName(files[0].name)}-rotated.pdf`);
}

async function transformImages(files,processor,zipLabel,onProgress){
  ensureImageFiles(files);const parts=[];
  for(let i=0;i<files.length;i++){
    report(onProgress,`Processing image ${i+1} of ${files.length}…`);
    const decoded=await decodeImage(files[i]);
    try{parts.push(await processor(files[i],decoded));}finally{decoded.cleanup();}
    await tick();
  }
  return packFiles(parts,zipLabel,onProgress);
}
const mimeFor = format => format==='jpg'?'image/jpeg':format==='png'?'image/png':'image/webp';
export async function convertImage(files,options,onProgress){
  const format=['png','jpg','webp'].includes(options.format)?options.format:'webp';
  return transformImages(files,async(file,decoded)=>{
    const canvas=makeCanvas(decoded,decoded.width,decoded.height,format==='jpg');
    return {blob:await canvasBlob(canvas,mimeFor(format),Number(options.quality)||0.85),name:outputName(file,format)};
  },'converted-images.zip',onProgress);
}
export async function resizeImage(files,options,onProgress){
  const width=clampSize(options.width,'Width');
  const lock=options.lockAspect!==false;
  const height=lock?null:clampSize(options.height,'Height');
  return transformImages(files,async(file,decoded)=>{
    const h=lock?Math.max(1,Math.round(decoded.height*width/decoded.width)):height;
    if(width*h>30_000_000)throw new Error('Selected dimensions exceed 30 million pixels. Choose a smaller size.');
    const format=/\.png$/i.test(file.name)?'png':/\.webp$/i.test(file.name)?'webp':'jpg';
    const canvas=makeCanvas(decoded,width,h,format==='jpg');
    const blob=await canvasBlob(canvas,mimeFor(format),0.9);
    return {blob,name:`${baseName(file.name)}-${width}x${h}.${format}`};
  },'resized-images.zip',onProgress);
}
export async function compressImage(files,options,onProgress){
  const format=options.format==='jpg'?'jpg':'webp';
  const quality=Number(options.quality)||0.75;
  const maxDimension=options.maxDimension?clampSize(options.maxDimension,'Max dimension'):0;
  return transformImages(files,async(file,decoded)=>{
    const factor=maxDimension?Math.min(1,maxDimension/Math.max(decoded.width,decoded.height)):1;
    const width=Math.max(1,Math.round(decoded.width*factor)),height=Math.max(1,Math.round(decoded.height*factor));
    const canvas=makeCanvas(decoded,width,height,format==='jpg');
    const blob=await canvasBlob(canvas,mimeFor(format),quality);
    return {blob,name:`${baseName(file.name)}-compressed.${format}`};
  },'compressed-images.zip',onProgress);
}
export const handlers={
  'images-to-pdf':imagesToPdf, 'pdf-to-png':pdfToPng, 'merge-pdf':mergePdf,
  'extract-pdf-pages':extractPdfPages,'rotate-pdf':rotatePdf,
  'convert-image':convertImage,'resize-image':resizeImage,'compress-image':compressImage
};
