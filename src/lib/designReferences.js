import { base44 } from '@/api/base44Client';

export const MAX_DESIGN_IMAGES=4;
export function validateDesignImage(file){if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Use a PNG, JPG or WebP screenshot.');if(file.size>10*1024*1024)throw new Error('Each original image must be smaller than 10 MB.');if(!file.size)throw new Error('This image is empty.');}
export async function prepareDesignImage(file){
  validateDesignImage(file);const url=URL.createObjectURL(file);
  try{
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('This image could not be decoded. Try exporting it as PNG or JPG.'));img.src=url;});
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>50000000)throw new Error('Use an image with at most 50 megapixels.');
    const ratio=Math.min(1,2560/Math.max(image.naturalWidth,image.naturalHeight)),width=Math.round(image.naturalWidth*ratio),height=Math.round(image.naturalHeight*ratio),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)throw new Error('Image processing is unavailable in this browser.');context.fillStyle='#ffffff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob||blob.size>3*1024*1024)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
    if(!blob||blob.size>4*1024*1024)throw new Error('This image remains too large after optimization. Crop it into separate screens.');
    return {file:new File([blob],file.name.replace(/\.[^.]+$/,'')+(blob.type==='image/png'?'.png':'.jpg'),{type:blob.type}),width,height};
  }finally{URL.revokeObjectURL(url);}
}
export async function uploadDesignReference(file){const prepared=await prepareDesignImage(file);const {file_uri}=await base44.integrations.Core.UploadPrivateFile({file:prepared.file});if(!file_uri)throw new Error('Image upload did not return a private file reference.');const {signed_url}=await base44.integrations.Core.CreateFileSignedUrl({file_uri,expires_in:1800});return {file_uri,name:file.name,width:prepared.width,height:prepared.height,preview_url:signed_url};}
export async function referenceUrls(references){return Promise.all(references.map(async image=>{const {signed_url}=await base44.integrations.Core.CreateFileSignedUrl({file_uri:image.file_uri,expires_in:1800});if(!signed_url)throw new Error('Could not open an image reference. Upload it again.');return signed_url;}));}
export const savedReferences=images=>images.map(({file_uri,name,width,height})=>({file_uri,name,width,height}));
