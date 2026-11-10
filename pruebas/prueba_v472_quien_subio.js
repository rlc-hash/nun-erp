// v4.72 / app v2.1.10 (Rafa 10 nov): se ve QUIÉN SUBIÓ cada cotización (columna "Subió" en Cotizaciones del ERP; "subió X" en el CRM).
// Las que suben los vendedores ya traen creado_por (el servidor lo pone); las nuevas del ERP llevan el nombre de quien la captura.
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const sleep=t=>new Promise(z=>setTimeout(z,t));
(async()=>{const r={fallas:[]};try{
 // --- ERP ---
 const E=await import(path.join(__dirname,'..','supabase','functions','nun','emulador.js'));
 const fn=E.compilar(fs.readFileSync(path.join(__dirname,'..','backend','Codigo.gs'),'utf8'));
 const DB=new Map(); let PROPS={en_supabase:'1'}; const COD='DUENO-PRUEBA1';
 const servidor=async(tipo,payload)=>{ const x=await E.atender({fn,existentes:[...DB.keys()],props:PROPS,cargar:async ns=>new Map(ns.map(n=>[n,JSON.parse(JSON.stringify(DB.get(n)||[]))])),
   sesion:c=>String(c||'').toUpperCase()===COD,admin:c=>String(c||'').toUpperCase()===COD,tipo,payload});
   for(const s of x.sucias) DB.set(s.nombre,JSON.parse(JSON.stringify(s.filas))); if(x.props) PROPS=x.props; return x.texto; };
 const post=async b=>JSON.parse(await servidor('post',JSON.stringify(Object.assign({codigo:COD},b))));
 await post({accion:'inicializar'});
 await post({accion:'erp_crear',tabla:'cotizaciones',item:{id:'c1',folio:'C0101',fecha:'2026-11-10',cliente:'CLIENTE A',vendedor:'LUIS',estatus:'enviada',total:100,items_json:'[]',creado_por:'EDGAR'}});
 const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(String(e.message).slice(0,200)));
 const dom=new JSDOM(fs.readFileSync(process.env.NUN_INDEX||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://rlc-hash.github.io/nun-erp/',
  beforeParse(w){ w.localStorage.setItem('nun_sesion_v2',JSON.stringify({codigo:COD,usuario:{codigo:COD,nombre:'Yazmin',rol:'admin'},permisos:{},ts:1}));
   w.fetch=async(u,o)=>{ const t=!o||!o.body?JSON.stringify({ok:true}):await servidor('post',o.body); return {ok:true,json:async()=>JSON.parse(t),text:async()=>t,clone(){return this;}}; };
   w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({}, {get:()=>()=>({})}); }});
 const w=dom.window,d=w.document; await sleep(3000);
 await w.eval("navegar('cotizaciones')"); await sleep(600);
 const t=(d.getElementById('content')||d.body).textContent.replace(/\s+/g,' ');
 r.erp={columna:/Subió/.test(t), valor:/C0101.*EDGAR/.test(t)}; if(!r.erp.columna||!r.erp.valor) r.fallas.push('erpColumna');
 r.version=(d.querySelector('.rwd-version')||{}).textContent; if(!/v4\.(7[2-9]|[89]\d)/.test(r.version||'')) r.fallas.push('version');
 w.close();
 // --- CRM ---
 const HTML=fs.readFileSync(path.join(__dirname,'..','ventas','index.html'),'utf8').replace(/<script src="\.\.\/nun-pdf\.js[^"]*"><\/script>/, '<script>'+fs.readFileSync(path.join(__dirname,'..','nun-pdf.js'),'utf8')+'</script>');
 const DB2={clientes:[],productos:[],pedidos:[],remisiones:[],ingresos:[],pagosverificar:[],facturas:[],cobranza:[],
  cotizaciones:[{id:'c1',folio:'C0101',fecha:'2026-11-10',cliente:'CLIENTE A',vendedor:'LUIS',estatus:'enviada',total:100,items_json:'[]',creado_por:'RAFA (capturó Claude)'}]};
 const dom2=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://rlc-hash.github.io/nun-erp/ventas/',
  beforeParse(w){ w.scrollTo=()=>{}; w.fetch=async(u,o)=>{ const b=JSON.parse(o.body); let x={ok:true};
    if(b.accion==='login') x={ok:true,usuario:{nombre:'Luis',rol:'vendedor',vendedor_asignado:'Luis'},permisos:{agregar_pedidos:true}};
    else if(b.accion==='erp_listar') x={ok:true,items:DB2[b.tabla]||[]}; return {json:async()=>x}; }; }});
 const w2=dom2.window,d2=w2.document; await sleep(400); d2.getElementById('lgCod').value='x'; await w2.eval('entrar()'); await sleep(300);
 await w2.eval("S.filtroPed='todo';ir('pedidos')"); r.crmLista=/C0101.*subió RAFA \(capturó Claude\)/.test(d2.getElementById('main').textContent);
 await w2.eval("abrirDoc('cotizaciones','c1')"); r.crmHoja=/subió RAFA/.test(d2.getElementById('hoja').textContent);
 r.crmVersion=(d2.querySelector('.ver')||{}).textContent;
 if(!r.crmLista||!r.crmHoja) r.fallas.push('crm'); if(!/^v2\.1\.(1\d|[2-9]\d)/.test(r.crmVersion)) r.fallas.push('crmVersion');
 r.errs=errs.slice(0,3);
}catch(e){r.error=String(e.stack).slice(0,500);}
console.log(JSON.stringify(r,null,1)); process.exit(r.error||r.fallas.length?1:0);})();
