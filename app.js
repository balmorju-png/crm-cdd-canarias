import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const KEY = "cdd_crm_supabase";
const FROM_HINT = "tania.herrero@compagniedesdesserts.com";
const FALLBACK = {
  isla: ["Tenerife", "Gran Canaria", "Lanzarote", "Fuerteventura", "La Palma", "La Gomera", "El Hierro"],
  localidad: ["Santa Cruz de Tenerife", "La Laguna", "Adeje", "Arona", "Puerto de la Cruz", "Los Cristianos", "Las Palmas de Gran Canaria", "Telde", "Maspalomas", "Arrecife", "Puerto del Rosario", "Santa Cruz de La Palma", "San Sebastián de La Gomera", "Valverde"],
  tipo_visita: ["Primera visita", "Seguimiento", "Toma de pedido", "Presentación de gama", "Entrega / merchandising", "Reclamación", "Cobro"],
  gama: ["Helados y sorbetes", "Tartas y entremets", "Petit fours", "Navidad / temporada", "Flor de la Pasión", "Salado / foie", "Novedades"],
  resultado: ["Pedido", "Interesado", "Pendiente", "No interesado", "Cerrado", "No localizado"],
  proxima_accion: ["Visitar", "Llamar", "Enviar oferta", "Enviar muestras", "Seguir pedido", "Cerrar"],
};

const state = { sb: null, session: null, perfil: null, cats: FALLBACK, visitas: [], route: location.hash.slice(1) || "/", error: "", busy: false };

function readCfg() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
function saveCfg(cfg) { localStorage.setItem(KEY, JSON.stringify(cfg)); }
function iso(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fmt(s) { if (!s) return "—"; const [y,m,d]=String(s).slice(0,10).split("-"); return y&&m&&d?`${d}/${m}/${y}`:s; }
function overdue(f) { return f && f.slice(0,10) < iso(); }
function monday(ref=new Date()) { const d=new Date(ref); d.setHours(0,0,0,0); const day=d.getDay(); d.setDate(d.getDate()+(day===0?-6:1-day)); return d; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&","<":"<",">":">","\"":""","'":"&#39;"}[c])); }
function qs(obj){ const p=new URLSearchParams(); Object.entries(obj).forEach(([k,v])=>{ if(v) p.set(k,v); }); return p.toString(); }
function connect(){ const cfg=readCfg(); if(!cfg?.url||!cfg?.anonKey){ state.sb=null; return null; } state.sb=createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true}}); return state.sb; }

async function boot(){
  connect();
  if(!state.sb){ render(); return; }
  const { data }=await state.sb.auth.getSession();
  state.session=data.session;
  if(state.session) await afterLogin();
  state.sb.auth.onAuthStateChange((_e,sess)=>{ state.session=sess; if(sess) afterLogin().then(render); else { state.perfil=null; state.visitas=[]; render(); } });
  render();
}
async function afterLogin(){
  const uid=state.session.user.id;
  const { data:p }=await state.sb.from("perfiles").select("*").eq("id",uid).maybeSingle();
  state.perfil=p;
  const { data:c }=await state.sb.from("catalogos").select("*").order("orden");
  if(c?.length){ const map={}; for(const row of c){ (map[row.tipo]??=[]).push(row.valor); } state.cats={...FALLBACK,...map}; }
  await loadVisitas();
}
async function loadVisitas(){
  const { data,error }=await state.sb.from("visitas").select("*").order("fecha",{ascending:false});
  if(error) state.error=error.message;
  state.visitas=data||[];
}
function go(path){ location.hash=path; }
window.addEventListener("hashchange",()=>{ state.route=location.hash.slice(1)||"/"; state.error=""; render(); });

function layout(inner){
  const r=state.route.split("?")[0];
  const links=[["/","Visitas"],["/nueva","Nueva"],["/cliente","Cliente"],["/dashboard","Panel"],["/parte","Parte"]];
  const nav=links.map(([h,l])=>`<a class="nav-link${r===h?" active":""}" href="#${h}">${l}</a>`).join("");
  const tabs=links.map(([h,l])=>`<a class="${r===h?"active":""}" href="#${h}">${l}</a>`).join("");
  const name=esc(state.perfil?.nombre||state.perfil?.email||state.session?.user.email||"");
  const rol=state.perfil?.rol==="admin"?"Administración":"Comercial";
  return `<div class="app-shell"><aside class="sidebar"><div><div class="brand-kicker">La Compagnie des Desserts</div><h1 class="brand">CRM Canarias<span>Visitas comerciales</span></h1></div>${nav}<div class="spacer"></div><div class="user-chip"><b>${name}</b>${rol}</div><button class="btn ghost" id="logout" style="margin-top:10px;color:#f3e4d8;border-color:#7a3a48">Cerrar sesión</button></aside><div><div class="topbar-mobile"><div class="brand">CRM Canarias</div><button class="btn ghost" id="logout2">Salir</button></div><main class="content">${inner}</main></div><nav class="tabbar">${tabs}</nav></div>`;
}

function screenAuth(){
  const cfg=readCfg();
  if(!cfg){
    return `<div class="auth-wrap"><form class="card auth-card" id="setup"><div class="brand-kicker">La Compagnie des Desserts</div><h1>Conectar nube</h1><p class="hint">Una vez. Luego el iPhone y el portátil ven lo mismo.</p><ol class="steps"><li>Crea un proyecto en supabase.com</li><li>SQL Editor: pega supabase/000_todo.sql</li><li>Authentication → Email ON, Confirm email OFF</li><li>Settings → API: URL y anon key</li></ol><div class="field" style="margin-top:12px"><label>Project URL</label><input name="url" required placeholder="https://xxxx.supabase.co"></div><div class="field" style="margin-top:10px"><label>anon public key</label><textarea name="anonKey" required></textarea></div><button class="btn block" style="margin-top:16px">Guardar y continuar</button></form></div>`;
  }
  return `<div class="auth-wrap"><form class="card auth-card" id="login"><div class="brand-kicker">La Compagnie des Desserts</div><h1>CRM Canarias</h1><p class="hint">Entra con tu email de trabajo.</p><div class="field" style="margin-top:12px"><label>Nombre (solo al crear cuenta)</label><input name="nombre" autocomplete="name"></div><div class="field" style="margin-top:12px"><label>Email</label><input type="email" name="email" required autocomplete="username"></div><div class="field" style="margin-top:12px"><label>Contraseña</label><input type="password" name="password" required minlength="6" autocomplete="current-password"></div>${state.error?`<p class="error">${esc(state.error)}</p>`:""}<button class="btn block" style="margin-top:16px">Entrar</button><button class="btn ghost block" style="margin-top:8px" name="crear" type="button">Crear cuenta</button><button class="btn ghost block" style="margin-top:8px" name="resetcfg" type="button">Cambiar proyecto Supabase</button></form></div>`;
}

function screenVisitas(){
  const p=new URLSearchParams(state.route.split("?")[1]||"");
  const isla=p.get("isla")||"", localidad=p.get("localidad")||"", resultado=p.get("resultado")||"", q=p.get("q")||"";
  const rows=state.visitas.filter(r=>{
    if(isla&&r.isla!==isla) return false;
    if(localidad&&r.localidad!==localidad) return false;
    if(resultado&&r.resultado!==resultado) return false;
    if(q&&!`${r.establecimiento} ${r.contacto||""} ${r.localidad||""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const opt=(arr,sel)=>arr.map(v=>`<option ${v===sel?"selected":""}>${esc(v)}</option>`).join("");
  const list=rows.length?rows.map(r=>`<a class="card visita-row" href="#/visita/${r.id}"><div class="visita-date">${fmt(r.fecha)}</div><div><div class="visita-title">${esc(r.establecimiento)}</div><div class="visita-meta">${esc(r.isla)}${r.localidad?" · "+esc(r.localidad):""}${r.contacto?" · "+esc(r.contacto):""}</div></div><div>${r.resultado?`<span class="pill${r.resultado==="Pedido"?" pedido":""}">${esc(r.resultado)}</span>`:""} ${overdue(r.fecha_proxima)?`<span class="pill vencida">Vencida</span>`:""}</div></a>`).join(""):`<div class="card empty">Aún no hay visitas con estos filtros.</div>`;
  return `<div class="page-head"><div><h1>Visitas</h1><p>${rows.length} de ${state.visitas.length} · más recientes primero</p></div><a class="btn" href="#/nueva">+ Nueva visita</a></div><form class="filters" id="filtros"><input name="q" placeholder="Buscar establecimiento o contacto" value="${esc(q)}"><select name="isla"><option value="">Todas las islas</option>${opt(state.cats.isla,isla)}</select><select name="localidad"><option value="">Todas las localidades</option>${opt(state.cats.localidad,localidad)}</select><select name="resultado"><option value="">Todos los resultados</option>${opt(state.cats.resultado,resultado)}</select></form>${list}`;
}

function screenForm(){
  const path=state.route.split("?")[0];
  const id=path.startsWith("/visita/")?path.slice("/visita/".length):"";
  const params=new URLSearchParams(state.route.split("?")[1]||"");
  const found=id?state.visitas.find(v=>v.id===id):null;
  const f=found||{fecha:iso(),isla:params.get("isla")||"Tenerife",localidad:params.get("localidad")||"",establecimiento:params.get("establecimiento")||"",contacto:"",tipo_visita:"",gama:"",resultado:"",proxima_accion:"",fecha_proxima:"",observaciones:""};
  const sel=(name,arr,val)=>`<select name="${name}"><option value="">—</option>${arr.map(v=>`<option ${v===val?"selected":""}>${esc(v)}</option>`).join("")}</select>`;
  return `<div class="page-head"><div><h1>${id?"Editar visita":"Nueva visita"}</h1><p>Los 11 campos. El date picker del iPhone muestra dd/mm/aaaa.</p></div></div><form class="card" style="padding:18px" id="form-visita" data-id="${esc(id)}"><div class="form-grid"><div class="field"><label>Fecha</label><input type="date" name="fecha" required value="${esc(f.fecha||"")}"></div><div class="field"><label>Isla</label>${sel("isla",state.cats.isla,f.isla).replace('<option value="">—</option>',"")}</div><div class="field"><label>Localidad</label>${sel("localidad",state.cats.localidad,f.localidad)}</div><div class="field"><label>Establecimiento</label><input name="establecimiento" required value="${esc(f.establecimiento||"")}"></div><div class="field"><label>Contacto</label><input name="contacto" value="${esc(f.contacto||"")}"></div><div class="field"><label>Tipo de visita</label>${sel("tipo_visita",state.cats.tipo_visita,f.tipo_visita)}</div><div class="field"><label>Gama</label>${sel("gama",state.cats.gama,f.gama)}</div><div class="field"><label>Resultado</label>${sel("resultado",state.cats.resultado,f.resultado)}</div><div class="field"><label>Próxima acción</label>${sel("proxima_accion",state.cats.proxima_accion,f.proxima_accion)}</div><div class="field"><label>Fecha próxima</label><input type="date" name="fecha_proxima" value="${esc(f.fecha_proxima||"")}"></div><div class="field full"><label>Observaciones</label><textarea name="observaciones">${esc(f.observaciones||"")}</textarea></div></div>${state.error?`<p class="error">${esc(state.error)}</p>`:""}<div class="row-btns no-print"><button class="btn">${state.busy?"Guardando…":"Guardar"}</button><a class="btn ghost" href="#/">Cancelar</a>${id?`<button type="button" class="btn ghost" id="borrar">Borrar</button>`:""}</div></form>`;
}

function screenCliente(){
  const q=new URLSearchParams(state.route.split("?")[1]||"").get("q")||"";
  const names=[...new Set(state.visitas.map(r=>r.establecimiento))].sort((a,b)=>a.localeCompare(b,"es"));
  const matches=q?names.filter(n=>n.toLowerCase().includes(q.toLowerCase())):[];
  const chosen=names.find(n=>n.toLowerCase()===q.trim().toLowerCase())||(matches.length===1?matches[0]:"");
  const history=chosen?state.visitas.filter(r=>r.establecimiento===chosen):[];
  const last=history[0];
  let extra="";
  if(!q) extra=`<div class="card empty">Empieza a escribir el nombre del establecimiento.</div>`;
  else if(!chosen) extra=matches.slice(0,20).map(n=>`<a class="card visita-row" href="#/cliente?q=${encodeURIComponent(n)}"><div class="visita-title">${esc(n)}</div></a>`).join("")||`<div class="card empty">Sin coincidencias.</div>`;
  if(last){
    const estado=last.fecha_proxima?(overdue(last.fecha_proxima)?"Vencida":"En plazo"):"Sin fecha";
    extra=`<div class="kpis"><div class="card kpi"><div class="l">Última visita</div><div class="n" style="font-size:22px">${fmt(last.fecha)}</div></div><div class="card kpi"><div class="l">Resultado</div><div class="n" style="font-size:22px">${esc(last.resultado||"—")}</div></div><div class="card kpi"><div class="l">Próxima acción</div><div class="n" style="font-size:22px"><span class="pill ${estado==="Vencida"?"vencida":"plazo"}">${estado}</span></div></div></div><div class="card" style="padding:18px;margin-bottom:16px"><div class="visita-title">${esc(chosen)}</div><p class="visita-meta">${esc(last.isla)}${last.localidad?" · "+esc(last.localidad):""}${last.contacto?" · "+esc(last.contacto):""}${last.proxima_accion?" · "+esc(last.proxima_accion):""} ${fmt(last.fecha_proxima)}</p><a class="btn" href="#/nueva?${qs({establecimiento:chosen,isla:last.isla,localidad:last.localidad})}">Nueva visita a este cliente</a></div><h2>Historial</h2><div class="visita-list">${history.map(r=>`<a class="card visita-row" href="#/visita/${r.id}"><div class="visita-date">${fmt(r.fecha)}</div><div class="visita-meta">${esc(r.tipo_visita||"Visita")} · ${esc(r.gama||"—")}</div><span class="pill">${esc(r.resultado||"—")}</span></a>`).join("")}</div>`;
  }
  return `<div class="page-head"><div><h1>Ficha cliente</h1><p>Última visita, próxima acción y estado vencida / en plazo.</p></div></div><form class="field" style="margin-bottom:16px" id="busca-cli"><label>Establecimiento</label><input name="q" list="ests" value="${esc(q)}" placeholder="Escribe para buscar…"><datalist id="ests">${names.map(n=>`<option value="${esc(n)}">`).join("")}</datalist></form>${extra}`;
}

function group(rows,key){ const m=new Map(); for(const r of rows){ const k=r[key]||"Sin dato"; m.set(k,(m.get(k)||0)+1);} return [...m.entries()].sort((a,b)=>b[1]-a[1]); }
function pct(n,t){ return t?Math.round((n/t)*100):0; }
function screenDash(){
  const rows=state.visitas;
  const clientes=new Set(rows.map(r=>r.establecimiento)).size;
  const pedidos=rows.filter(r=>(r.resultado||"").toLowerCase()==="pedido").length;
  const w0=monday(), w1=addDays(w0,7);
  const agenda=rows.filter(r=>r.fecha_proxima&&r.fecha_proxima>=iso(w0)&&r.fecha_proxima<iso(w1)).length;
  const vencidas=rows.filter(r=>overdue(r.fecha_proxima)).length;
  const bars=(title,key)=>{ const g=group(rows,key); return `<div class="card bars"><strong>${title}</strong>${g.map(([l,n])=>`<div class="bar-row"><span>${esc(l)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct(n,rows.length)}%"></div></div><span>${pct(n,rows.length)}%</span></div>`).join("")}</div>`; };
  return `<div class="page-head"><div><h1>Dashboard</h1><p>Lectura en vivo de tus visitas.</p></div></div><div class="kpis"><div class="card kpi"><div class="l">Visitas</div><div class="n">${rows.length}</div></div><div class="card kpi"><div class="l">Clientes únicos</div><div class="n">${clientes}</div></div><div class="card kpi"><div class="l">Pedidos</div><div class="n">${pedidos}</div></div><div class="card kpi"><div class="l">Conversión</div><div class="n">${pct(pedidos,rows.length)}%</div></div><div class="card kpi"><div class="l">Agenda esta semana</div><div class="n">${agenda}</div></div><div class="card kpi"><div class="l">Vencidas</div><div class="n">${vencidas}</div></div></div><div style="display:grid;gap:12px">${bars("Pipeline (resultado)","resultado")}${bars("Mix de gama","gama")}${bars("Islas","isla")}${bars("Localidades","localidad")}</div>`;
}
function weekRows(offset){ const start=addDays(monday(),offset*7); const days=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].map((name,i)=>({name,iso:iso(addDays(start,i))})); return {start,days}; }
function screenParte(){
  const offset=Number(new URLSearchParams(state.route.split("?")[1]||"").get("w")||0);
  const {days}=weekRows(offset); const by={}; days.forEach(d=>by[d.iso]=[]);
  state.visitas.forEach(r=>{ if(by[r.fecha]) by[r.fecha].push(r); });
  const all=days.flatMap(d=>by[d.iso]); const label=`${fmt(days[0].iso)} – ${fmt(days[6].iso)}`;
  return `<div class="page-head no-print"><div><h1>Parte semanal</h1><p>${label} · ${all.length} visitas · no el CRM entero</p></div><div class="row-btns"><a class="btn ghost" href="#/parte?w=${offset-1}">← Semana</a><a class="btn ghost" href="#/parte?w=0">Esta</a><a class="btn ghost" href="#/parte?w=${offset+1}">Semana →</a></div></div><p class="hint no-print">Al compartir deja el destinatario vacío. Remitente sugerido: ${FROM_HINT}</p><div class="row-btns no-print"><button class="btn" id="share" data-w="${offset}">Compartir</button><button class="btn ghost" id="csv" data-w="${offset}">CSV</button><button class="btn ghost" id="pdf">PDF (imprimir)</button></div>${days.map(d=>`<section class="card" style="padding:14px;margin-bottom:10px"><div class="visita-title">${d.name} · ${fmt(d.iso)}</div>${by[d.iso].length?by[d.iso].map(r=>`<p class="visita-meta">${esc(r.establecimiento)} · ${esc(r.isla)}${r.localidad?", "+esc(r.localidad):""} · ${esc(r.resultado||"—")}${r.observaciones?" — "+esc(r.observaciones):""}</p>`).join(""):`<p class="hint">Sin visitas</p>`}</section>`).join("")}`;
}

function render(){
  const root=document.getElementById("app");
  if(!readCfg()||!state.session){ root.innerHTML=screenAuth(); bindAuth(); return; }
  const path=state.route.split("?")[0];
  let inner=screenVisitas();
  if(path==="/nueva"||path.startsWith("/visita/")) inner=screenForm();
  else if(path==="/cliente") inner=screenCliente();
  else if(path==="/dashboard") inner=screenDash();
  else if(path==="/parte") inner=screenParte();
  root.innerHTML=layout(inner); bindApp();
}
function bindAuth(){
  const setup=document.getElementById("setup");
  if(setup) setup.addEventListener("submit",e=>{ e.preventDefault(); const fd=new FormData(setup); saveCfg({url:String(fd.get("url")).trim(),anonKey:String(fd.get("anonKey")).trim()}); connect(); render(); });
  const login=document.getElementById("login"); if(!login) return;
  login.addEventListener("submit",async e=>{ e.preventDefault(); const fd=new FormData(login); state.error=""; const {error}=await state.sb.auth.signInWithPassword({email:fd.get("email"),password:fd.get("password")}); if(error){ state.error=error.message; render(); } });
  login.querySelector("[name=crear]").addEventListener("click",async()=>{ const fd=new FormData(login); state.error=""; const {error}=await state.sb.auth.signUp({email:fd.get("email"),password:fd.get("password"),options:{data:{nombre:fd.get("nombre")}}}); if(error){ state.error=error.message; render(); } else { state.error="Cuenta creada. Si no entra solo, pulsa Entrar."; render(); } });
  login.querySelector("[name=resetcfg]").addEventListener("click",()=>{ localStorage.removeItem(KEY); state.sb=null; render(); });
}
function bindApp(){
  document.getElementById("logout")?.addEventListener("click",()=>state.sb.auth.signOut());
  document.getElementById("logout2")?.addEventListener("click",()=>state.sb.auth.signOut());
  const filt=document.getElementById("filtros");
  if(filt){ const apply=()=>{ const fd=new FormData(filt); go("/?"+qs({q:fd.get("q"),isla:fd.get("isla"),localidad:fd.get("localidad"),resultado:fd.get("resultado")})); }; filt.addEventListener("change",apply); filt.querySelector("[name=q]").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); apply(); } }); }
  const busca=document.getElementById("busca-cli");
  if(busca) busca.addEventListener("submit",e=>{ e.preventDefault(); go("/cliente?q="+encodeURIComponent(new FormData(busca).get("q")||"")); });
  const form=document.getElementById("form-visita");
  if(form){
    form.addEventListener("submit",async e=>{
      e.preventDefault(); const fd=new FormData(form); const id=form.dataset.id||undefined;
      const payload={ user_id:state.session.user.id, fecha:fd.get("fecha"), isla:fd.get("isla"), localidad:fd.get("localidad")||null, establecimiento:fd.get("establecimiento"), contacto:fd.get("contacto")||null, tipo_visita:fd.get("tipo_visita")||null, gama:fd.get("gama")||null, resultado:fd.get("resultado")||null, proxima_accion:fd.get("proxima_accion")||null, fecha_proxima:fd.get("fecha_proxima")||null, observaciones:fd.get("observaciones")||null };
      state.busy=true; render();
      const q=id?state.sb.from("visitas").update(payload).eq("id",id):state.sb.from("visitas").insert(payload);
      const {error}=await q; state.busy=false;
      if(error){ state.error=error.message; render(); return; }
      await loadVisitas(); go("/");
    });
    document.getElementById("borrar")?.addEventListener("click",async()=>{ if(!confirm("¿Borrar esta visita?")) return; await state.sb.from("visitas").delete().eq("id",form.dataset.id); await loadVisitas(); go("/"); });
  }
  document.getElementById("pdf")?.addEventListener("click",()=>window.print());
  document.getElementById("csv")?.addEventListener("click",e=>downloadCsv(Number(e.target.dataset.w||0)));
  document.getElementById("share")?.addEventListener("click",e=>shareWeek(Number(e.target.dataset.w||0)));
}
function weekCsv(offset){
  const {days}=weekRows(offset); const set=new Set(days.map(d=>d.iso));
  const rows=state.visitas.filter(r=>set.has(r.fecha));
  const header=["Fecha","Isla","Localidad","Establecimiento","Contacto","Tipo","Gama","Resultado","Próxima acción","Fecha próxima","Observaciones"];
  const cell=s=>/[ ";,\n]/.test(s||"")?`"${String(s).replace(/"/g,'""')}"`:(s||"");
  const lines=[header.join(";")];
  for(const r of rows) lines.push([fmt(r.fecha),r.isla,r.localidad,r.establecimiento,r.contacto,r.tipo_visita,r.gama,r.resultado,r.proxima_accion,fmt(r.fecha_proxima),(r.observaciones||"").replace(/\n/g," ")].map(cell).join(";"));
  return {csv:lines.join("\n"),name:`parte-semanal-${days[0].iso}.csv`,label:`${fmt(days[0].iso)} – ${fmt(days[6].iso)}`,n:rows.length};
}
function downloadCsv(offset){ const {csv,name}=weekCsv(offset); const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"})); a.download=name; a.click(); }
async function shareWeek(offset){
  const {csv,name,label,n}=weekCsv(offset);
  const file=new File(["\uFEFF"+csv],name,{type:"text/csv"});
  const text=`Parte semanal ${label}\n${state.perfil?.nombre||""}\n${n} visitas`;
  if(navigator.canShare?.({files:[file]})){ await navigator.share({files:[file],title:`Parte semanal ${label}`,text}); return; }
  location.href=`mailto:?subject=${encodeURIComponent("Parte semanal "+label)}&body=${encodeURIComponent(text+"\n\nAdjunta el CSV.\nRemitente sugerido: "+FROM_HINT)}`;
}
boot();
