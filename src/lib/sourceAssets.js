export async function mirrorPublicAssets(source, progress = () => {}) {
  const files=source.map(file=>({...file})), urls=new Set();
  for(const file of files) if(typeof file.content==='string') for(const match of file.content.matchAll(/https:\/\/media\.base44\.com\/[^\s"'`<>)\]}]+/g)) urls.add(match[0]);
  if(urls.size>50)throw new Error('This source references more than 50 external platform assets. Migrate its media separately.');
  const map={},missing=[];let total=0;
  for(const url of urls) {
    progress('Copying referenced public assets…');
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      if(Number(response.headers.get('content-length'))>10*1024*1024)throw new Error('Asset too large');
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>10*1024*1024)throw new Error('Asset too large');chunks.push(chunk);}
      if(total+size>40*1024*1024)throw new Error('Copied public assets exceed 40 MB');
      total+=size;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url)))].slice(0,6).map(value=>value.toString(16).padStart(2,'0')).join('');
      const filename=hash+'-'+new URL(url).pathname.split('/').at(-1).replace(/[^A-Za-z0-9_.-]/g,'_');
      map[url]='/imported-assets/'+filename;files.push({path:'public/imported-assets/'+filename,content:bytes});
    }catch(error){missing.push({url,reason:error.message});}
  }
  return {files,assetMap:map,missing};
}
