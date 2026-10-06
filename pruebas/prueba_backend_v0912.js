// v0.9.12 — listas en memoria rápida (CacheService) que se invalidan con cualquier cambio. Hoja SIMULADA, datos inventados. con una hoja de Google SIMULADA en memoria (sin red, datos inventados).
const fs=require('fs'),path=require('path'),vm=require('vm');
const code=fs.readFileSync(path.join(__dirname,'..','backend','Codigo.gs'),'utf8');
function hojaMock(nombre){ const h={_n:nombre,rows:[],
  appendRow(r){ this.rows.push(r.slice()); }, getLastRow(){ return this.rows.length; }, getLastColumn(){ return Math.max(0,...this.rows.map(r=>r.length)); },
  getDataRange(){ const me=this; return { getValues(){ const w=me.getLastColumn(); return me.rows.map(r=>{ const x=r.slice(); while(x.length<w) x.push(''); return x; }); } }; },
  getRange(r,c,nr,nc){ const me=this; nr=nr||1; nc=nc||1; const rg={
    getValues(){ const o=[]; for(let i=0;i<nr;i++){ const row=me.rows[r-1+i]||[]; const x=[]; for(let j=0;j<nc;j++) x.push(row[c-1+j]===undefined?'':row[c-1+j]); o.push(x);} return o; },
    setValues(v){ for(let i=0;i<v.length;i++){ while(me.rows.length<r+i) me.rows.push([]); for(let j=0;j<v[i].length;j++) me.rows[r-1+i][c-1+j]=v[i][j]; } return rg; },
    setValue(v){ while(me.rows.length<r) me.rows.push([]); me.rows[r-1][c-1]=v; return rg; },
    clearContent(){ for(let i=0;i<nr;i++) if(me.rows[r-1+i]) for(let j=0;j<nc;j++) me.rows[r-1+i][c-1+j]=''; me.rows=me.rows.filter((row,k)=>k===0||row.some(x=>x!=='')); return rg; },
    setFontWeight(){return rg;}, setBackground(){return rg;}, setFontColor(){return rg;} }; return rg; },
  deleteRow(i){ h.borrados=(h.borrados||0)+1; this.rows.splice(i-1,1); }, deleteRows(i,n){ h.borrados=(h.borrados||0)+n; this.rows.splice(i-1,n); }, setFrozenRows(){} }; return h; }
const hojas={}; const props={en_supabase:'1'}; const MEM={}; let lecturasHoja=0; // v0.9.13: en Google ya no se guarda; esta prueba revisa la memoria rápida
const CACHE={ get:k=>k in MEM?MEM[k]:null, put:(k,v)=>{MEM[k]=String(v);}, putAll:o=>{Object.assign(MEM,o);}, getAll:ks=>{const r={}; ks.forEach(k=>{ if(k in MEM) r[k]=MEM[k]; }); return r;}, remove:k=>{delete MEM[k];} };
const ctx={ console, JSON, Math, Date, String, Number, Object, Array, parseFloat, parseInt, isNaN, RegExp, Error,
  SpreadsheetApp:{ getActiveSpreadsheet:()=>({ getSheetByName:n=>hojas[n]||null, insertSheet:n=>(hojas[n]=hojaMock(n)) }), flush(){} },
  LockService:{ getScriptLock:()=>({ waitLock(){}, releaseLock(){} }) },
  CacheService:{ getScriptCache:()=>CACHE },
  PropertiesService:{ getScriptProperties:()=>({ getProperty:k=>props[k]||null, setProperty:(k,v)=>{props[k]=v;} }) },
  ContentService:{ createTextOutput:t=>({ t, setMimeType(){ return this; } }), MimeType:{JSON:'json'} },
  ScriptApp:{ getProjectTriggers:()=>[], deleteTrigger(){} }, Utilities:{}, UrlFetchApp:{ fetch(){ throw new Error('sin red'); } } };
vm.createContext(ctx); vm.runInContext(code,ctx);
const post=b=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(b)}}).t);
const get=p=>JSON.parse(ctx.doGet({parameter:p}).t);

const r={};
ctx.asegurarHoja('usuarios'); hojas['Usuarios'].appendRow(['DUENO-PRUEBA1','Dueño','admin','{}','','[]',2,true,'','']);
const C='DUENO-PRUEBA1';
// contar lecturas reales de la hoja de remisiones
const leer=()=>{ const h=hojas['Remisiones']; const g=h.getDataRange; if(!h._cuenta){ h._cuenta=true; h.getDataRange=function(){ lecturasHoja++; return g.call(h); }; } };
post({accion:'erp_crear',tabla:'remisiones',item:{id:'r1',folio:'R0001',cliente:'X',total:10},codigo:C}); leer();
lecturasHoja=0;
const a=post({accion:'erp_listar',tabla:'remisiones',codigo:C}); const b=post({accion:'erp_listar',tabla:'remisiones',codigo:C});
r.primera={items:a.items.length,lecturas:lecturasHoja}; lecturasHoja=0;
r.segunda={items:b.items.length,desdeMemoria:b.cache===true};
post({accion:'erp_upsert_batch',tabla:'remisiones',items:[{id:'r1',total:20}],codigo:C});
const c=post({accion:'erp_listar',tabla:'remisiones',codigo:C});
r.trasCambio={total:c.items[0].total,desdeMemoria:c.cache===true};
const g=get({tabla:'remisiones',codigo:C}); r.get={items:(g.data||[]).length};
ctx.onEdit({}); const d=post({accion:'erp_listar',tabla:'remisiones',codigo:C}); r.trasEditarHoja={desdeMemoria:d.cache===true};
r.version=post({accion:'erp_listar',tabla:'remisiones',codigo:C}).ok && JSON.parse(ctx.doGet({parameter:{}}).t).mensaje;
r.fallas=[];
if(r.primera.items!==1||!r.segunda.desdeMemoria) r.fallas.push('memoria');
if(r.trasCambio.total!==20||r.trasCambio.desdeMemoria) r.fallas.push('invalidar');
if(r.get.items!==1||r.trasEditarHoja.desdeMemoria) r.fallas.push('getYhoja');
if(!/v0\.9\.1[2-9]/.test(r.version)) r.fallas.push('version');
console.log(JSON.stringify(r,null,1));
