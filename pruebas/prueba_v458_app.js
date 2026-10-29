// v4.58 — App instalable con el logo NUN: manifest.webmanifest (íconos PNG 192/512 + maskable), apple-touch-icon y sw.js sin caché.
const fs=require('fs'),path=require('path');
const r={fallas:[]};
try{
 const raiz=path.join(__dirname,'..'), html=fs.readFileSync(process.env.NUN_INDEX||path.join(raiz,'index.html'),'utf8');
 const m=JSON.parse(fs.readFileSync(path.join(raiz,'manifest.webmanifest'),'utf8'));
 r.manifest={name:m.name,display:m.display,iconos:m.icons.map(i=>i.sizes+' '+(i.purpose||''))};
 if(m.display!=='standalone'||!m.icons.some(i=>i.sizes==='192x192')||!m.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable')) r.fallas.push('manifest');
 m.icons.concat([{src:'icons/apple-touch-icon.png'}]).forEach(i=>{ const f=path.join(raiz,i.src); if(!fs.existsSync(f)||fs.readFileSync(f).slice(1,4).toString()!=='PNG') r.fallas.push('icono '+i.src); });
 if(!/<link rel="manifest" href="manifest\.webmanifest">/.test(html)||!/rel="apple-touch-icon"/.test(html)) r.fallas.push('head');
 if(/data:application\/json;base64/.test(html)) r.fallas.push('manifest-viejo');
 const sw=fs.readFileSync(path.join(raiz,'sw.js'),'utf8'); if(/caches\./.test(sw)) r.fallas.push('sw-con-cache');
 r.version=(html.match(/v4\.\d+ · Sistema NUN/)||[''])[0];
 if(!/v4\.(5[8-9]|[6-9]\d)/.test(r.version)) r.fallas.push('version');
}catch(e){r.error=String(e.stack).slice(0,500)}
console.log(JSON.stringify(r,null,1));
