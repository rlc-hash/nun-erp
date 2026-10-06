// Prueba del servidor (backend/Codigo.gs v0.9.9+; v0.9.10: el usuario de Rafa protegido; v0.9.11: folios NUN siempre) con una hoja de Google SIMULADA en memoria (sin red, datos inventados).
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
const hojas={}; const props={};
const ctx={ console, JSON, Math, Date, String, Number, Object, Array, parseFloat, parseInt, isNaN, RegExp, Error,
  SpreadsheetApp:{ getActiveSpreadsheet:()=>({ getSheetByName:n=>hojas[n]||null, insertSheet:n=>(hojas[n]=hojaMock(n)) }), flush(){} },
  LockService:{ getScriptLock:()=>({ waitLock(){}, releaseLock(){} }) },
  CacheService:{ getScriptCache:()=>({ get:()=>null, put(){}, remove(){} }) },
  PropertiesService:{ getScriptProperties:()=>({ getProperty:k=>props[k]||null, setProperty:(k,v)=>{props[k]=v;} }) },
  ContentService:{ createTextOutput:t=>({ t, setMimeType(){ return this; } }), MimeType:{JSON:'json'} },
  ScriptApp:{ getProjectTriggers:()=>[], deleteTrigger(){} }, Utilities:{}, UrlFetchApp:{ fetch(){ throw new Error('sin red'); } } };
vm.createContext(ctx); vm.runInContext(code,ctx);
const post=b=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(b)}}).t);
// v0.9.13 — en Google (sin en_supabase) ya no se guarda; lo demás de esta prueba corre como en Supabase
const _r913={}; { ctx.asegurarHoja('usuarios'); hojas['Usuarios'].appendRow(['TMP-PRUEBA0','T','admin','{}','','[]',2,true,'','']);
  const x=post({accion:'erp_crear',tabla:'facturas',item:{id:'zz',cliente:'X'},codigo:'TMP-PRUEBA0'}); _r913.bloqueado=x.ok===false&&x.recargar===true;
  _r913.leerSi=post({accion:'erp_listar',tabla:'facturas',codigo:'TMP-PRUEBA0'}).ok===true; _r913.cuentasSi=post({accion:'listar_cuentas',codigo:'TMP-PRUEBA0'}).ok===true;
  hojas['Usuarios'].rows.pop(); }
props.en_supabase='1';
const get=p=>JSON.parse(ctx.doGet({parameter:p}).t);
const r={v0913:_r913};
// usuarios de prueba
ctx.asegurarHoja('usuarios'); const U=hojas['Usuarios'];
U.appendRow(['DUENO-PRUEBA1','Dueño','admin','{}','','[]',2,true,'','']);
U.appendRow(['VEND-PRUEBA2','Vendedor','vendedor','{}','EDGAR','[]',2,true,'','']);
U.appendRow(['VIEJO-PRUEBA3','Viejo','cobranza','{}','','[]',2,false,'','']);
r.login={ok:post({accion:'login',codigo:'VEND-PRUEBA2',device_id:'d1'}).ok, inactivo:post({accion:'login',codigo:'VIEJO-PRUEBA3',device_id:'d1'}).ok, maestroSinPropiedad:post({accion:'login',codigo:'RAFA_MASTER'}).ok};
props.codigo_maestro='MASTER-NUN-PRUEBA'; r.login.maestroConPropiedad=post({accion:'login',codigo:'master-nun-prueba'}).ok;
r.get={sinCodigo:get({tabla:'cobranza'}).ok, usuarios:get({tabla:'usuarios',codigo:'VEND-PRUEBA2'}).ok, cobranza:get({tabla:'cobranza',codigo:'VEND-PRUEBA2'}).ok};
r.post={pagoSinCodigo:post({accion:'capturar_pago',id_doc:'x',monto:1}).requiere_login===true, eliminarSinCodigo:post({accion:'eliminar',tabla:'cobranza',id:'x'}).requiere_login===true,
  listarUsuariosGenerico:post({accion:'erp_listar',tabla:'usuarios',codigo:'VEND-PRUEBA2'}).ok, listarUsuariosVendedor:post({accion:'listar_usuarios',codigo_admin:'VEND-PRUEBA2'}).ok,
  listarUsuariosAdmin:post({accion:'listar_usuarios',codigo_admin:'DUENO-PRUEBA1'}).ok, inicializarVendedor:post({accion:'inicializar',codigo:'VEND-PRUEBA2'}).ok,
  bind:post({accion:'bind_proxy',codigo:'DUENO-PRUEBA1'}).error};
// folios únicos
const C='DUENO-PRUEBA1';
const a=post({accion:'erp_crear',tabla:'facturas',item:{id:'fa',folio:'FT0001',cliente:'X',total:1},codigo:C});
const b=post({accion:'erp_crear',tabla:'facturas',item:{id:'fb',folio:'FT0001',cliente:'Y',total:2},codigo:C});
const b2=post({accion:'erp_crear',tabla:'facturas',item:{id:'fb',folio:'FT0001',cliente:'Y',total:2},codigo:C});
r.folios={a:a.item.folio,b:b.item.folio,cambiado:b.folio_cambiado===true,reintentoNoDuplica:b2.ya_existia===true,filas:post({accion:'erp_listar',tabla:'facturas',codigo:C}).items.length};
// cobranza + pago + anular pago (nada se borra)
post({accion:'erp_crear',tabla:'cobranza',item:{id:'c1',numero:'R0001',cliente:'X',total:100,cobrado:0,pendiente:100},codigo:C});
const pg=post({accion:'capturar_pago_cliente',id_doc:'c1',monto:40,fecha:'2026-09-30',cuenta:'BBVA',codigo_usuario:C,codigo:C});
const ts=hojas['PagosClientes'].rows[1][0];
const an=post({accion:'editar_pago_manual',timestamp:ts,nuevo_monto:0,codigo_usuario:C});
const ing=post({accion:'erp_listar',tabla:'ingresos',codigo:C}).items; const cob=post({accion:'erp_listar',tabla:'cobranza',codigo:C}).items[0];
r.pago={registrado:pg.ok,anulado:an.ok,ingresoSigue:ing.length,tipoIngreso:ing[0]&&ing[0].tipo,cobrado:cob.cobrado,pendiente:cob.pendiente,renglonPago:hojas['PagosClientes'].rows.length-1};
// eliminar genérico = marcar
post({accion:'eliminar',tabla:'cobranza',id:'c1',codigo:C});
r.eliminar={sigue:post({accion:'erp_listar',tabla:'cobranza',codigo:C}).items.length,estatus:post({accion:'erp_listar',tabla:'cobranza',codigo:C}).items[0].estatus};
r.borrarTodo=post({accion:'borrar_todo_cobranza',codigo:C,confirmacion:'BORRAR_TODO_COBRANZA_CONFIRMADO'}).ok;
r.dedupe=post({accion:'dedupe_cobranza',codigo:C}).ok; r.prefijo=post({accion:'erp_borrar_prefijo',prefijo:'bind_',codigo:C}).ok;
// inventario: apartar al crear pedido, liberar al convertir a remisión
ctx.asegurarHoja('productos'); const P=hojas['Productos']; const hp=P.rows[0]; const fila=hp.map(h=>({id:'p1',sku:'A1',stock_actual:10,stock_comprometido:0}[h]??''));
P.appendRow(fila);
const ped=post({accion:'erp_crear',tabla:'pedidos',item:{id:'ped1',folio:'P0001',cliente:'X',estatus:'confirmado',items_json:JSON.stringify([{sku:'A1',cantidad:3}])},codigo:C});
const prod=()=>{ const it=post({accion:'erp_listar',tabla:'productos',codigo:C}).items[0]; return it.stock_actual+'/'+it.stock_comprometido; };
r.inventario={trasPedido:prod()};
const conv=post({accion:'convertir_documento',tabla_origen:'pedidos',id_origen:'ped1',tabla_destino:'remisiones',usuario:'x',codigo:C});
r.inventario.trasRemision=prod();
post({accion:'erp_crear',tabla:'pedidos',item:{id:'ped2',folio:'P0002',cliente:'X',items_json:JSON.stringify([{sku:'A1',cantidad:2}])},codigo:C});
r.inventario.trasPedido2=prod(); post({accion:'pedido_liberar',id:'ped2',codigo:C}); r.inventario.trasCancelar=prod();
// usuarios: no se borran, no se puede dejar sin admin
r.usuarios={desactivarVend:post({accion:'eliminar_usuario',codigo:'VEND-PRUEBA2',codigo_admin:C}).ok, vendSigue:U.rows.some(x=>x[0]==='VEND-PRUEBA2'),
  reactivar:post({accion:'actualizar_usuario',codigo:'VEND-PRUEBA2',cambios:{activo:true},codigo_admin:C}).ok,
  ultimoAdmin:post({accion:'actualizar_usuario',codigo:C,cambios:{activo:false},codigo_admin:C}).error||'permitido'};
// v0.9.10 — el usuario de Rafa solo lo ve y lo cambia Rafa
U.appendRow(['RAFA-PRUEBA4','Rafa','admin','{}','','[]',2,true,'','']);
const lu=c=>(post({accion:'listar_usuarios',codigo_admin:c}).usuarios||[]).map(u=>u.codigo);
r.rafa={otroAdminLoVe:lu('DUENO-PRUEBA1').includes('RAFA-PRUEBA4'),rafaLoVe:lu('RAFA-PRUEBA4').includes('RAFA-PRUEBA4'),
  otroAdminLoDesactiva:post({accion:'actualizar_usuario',codigo:'RAFA-PRUEBA4',cambios:{activo:false},codigo_admin:'DUENO-PRUEBA1'}).ok,
  otroAdminCreaRafa:post({accion:'crear_usuario',datos:{codigo:'RAFA-FALSO9',nombre:'x',rol:'admin'},codigo_admin:'DUENO-PRUEBA1'}).ok,
  otroAdminCreaYadah:post({accion:'crear_usuario',datos:{codigo:'YADAH-FALSO9',nombre:'x',rol:'admin'},codigo_admin:'DUENO-PRUEBA1'}).ok,
  rafaCreaNuevo:post({accion:'crear_usuario',datos:{codigo:'RAFA-NUEVO77',nombre:'Rafa',rol:'admin'},codigo_admin:'RAFA-PRUEBA4'}).ok,
  rafaDesactivaViejo:post({accion:'actualizar_usuario',codigo:'RAFA-PRUEBA4',cambios:{activo:false},codigo_admin:'RAFA-NUEVO77'}).ok};
// v0.9.11 — folios NUN siempre (ya no REM-2026-0001)
r.folioNUN={convertida:conv.folio,guardada:(post({accion:'erp_listar',tabla:'remisiones',codigo:C}).items.find(x=>x.id===conv.nuevoId)||{}).folio,
  pedidoViejo:post({accion:'erp_crear',tabla:'pedidos',item:{id:'ped3',folio:'PED-2026-0005',cliente:'X'},codigo:C}).item.folio,
  pedidoSinFolio:post({accion:'erp_crear',tabla:'pedidos',item:{id:'ped4',cliente:'X'},codigo:C}).item.folio,
  facturaBind:post({accion:'erp_crear',tabla:'facturas',item:{id:'bind_fac_9',folio:'1106',cliente:'X'},codigo:C}).item.folio};
r.borradosHoja=Object.values(hojas).reduce((s,h)=>s+(h.borrados||0),0);
const f=[]; if(r.login.ok!==true||r.login.inactivo!==false||r.login.maestroSinPropiedad!==false||r.login.maestroConPropiedad!==true) f.push('login');
if(r.get.sinCodigo!==false||r.get.usuarios!==false||r.get.cobranza!==true) f.push('get');
if(!r.post.pagoSinCodigo||!r.post.eliminarSinCodigo||r.post.listarUsuariosGenerico!==false||r.post.listarUsuariosVendedor!==false||r.post.listarUsuariosAdmin!==true||r.post.inicializarVendedor!==false||!/ya no se usa/.test(r.post.bind||'')) f.push('candados');
if(r.folios.a!=='FT0001'||r.folios.b!=='FT0002'||!r.folios.cambiado||!r.folios.reintentoNoDuplica||r.folios.filas!==2) f.push('folios');
if(!r.pago.registrado||!r.pago.anulado||r.pago.ingresoSigue!==1||r.pago.tipoIngreso!=='CANCELADO'||r.pago.cobrado!==0||r.pago.pendiente!==100||r.pago.renglonPago!==1) f.push('pago');
if(r.eliminar.sigue!==1||r.eliminar.estatus!=='cancelado'||r.borrarTodo||r.dedupe||r.prefijo) f.push('noBorrar');
if(r.inventario.trasPedido!=='10/3'||r.inventario.trasRemision!=='7/0'||r.inventario.trasPedido2!=='7/2'||r.inventario.trasCancelar!=='7/0') f.push('inventario');
if(!r.usuarios.desactivarVend||!r.usuarios.vendSigue||!r.usuarios.reactivar||!/único administrador/.test(r.usuarios.ultimoAdmin)) f.push('usuarios');
if(r.borradosHoja!==0) f.push('seBorraronRenglones');
if(r.rafa.otroAdminLoVe||!r.rafa.rafaLoVe||r.rafa.otroAdminLoDesactiva||r.rafa.otroAdminCreaRafa||r.rafa.otroAdminCreaYadah||!r.rafa.rafaCreaNuevo||!r.rafa.rafaDesactivaViejo) f.push('rafaProtegido');
if(r.folioNUN.convertida!=='R0001'||r.folioNUN.guardada!=='R0001'||r.folioNUN.pedidoViejo!=='P0003'||r.folioNUN.pedidoSinFolio!=='P0004'||r.folioNUN.facturaBind!=='1106') f.push('folioNUN');
if(!r.v0913.bloqueado||!r.v0913.leerSi||!r.v0913.cuentasSi) f.push('v0913');
r.fallas=f; console.log(JSON.stringify(r,null,1));
