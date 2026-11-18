/* ============================================================
   Programa 5S — Auditoria Interna · Raguife
   Painel público + lançamento restrito a auditores.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
         sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, onSnapshot, setDoc, deleteDoc,
         writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, CONFIGURADO } from "./firebase-config.js";
import { S_INFO, LEG, CHECKLIST_PADRAO, SETORES_PADRAO, CFG_PADRAO, MESES, ACAO_STATUS,
         AP, AD, blocoTotal, resultado, preenchidos, contaNC } from "./dados.js";
import { pdfPeriodo, pdfAuditoria, periodoLabel } from "./pdf.js";

/* ============================ estado ============================ */
const S = {
  db:null, auth:null, user:null, perfil:null,          // perfil = documento usuarios/{uid}
  cfg:{...CFG_PADRAO}, setores:SETORES_PADRAO, checklist:CHECKLIST_PADRAO,
  resultados:[], auditorias:[], acoes:[],
  view:"painel", periodo:null, loading:true, lento:false, semBanco:!CONFIGURADO,
  form:null, fAcao:{setor:"",status:""}, fAud:{setor:""},
  unsubPriv:[]
};
const podeLancar = () => !!(S.perfil && (S.perfil.papel === "auditor" || S.perfil.papel === "gestor"));
const ehGestor  = () => !!(S.perfil && S.perfil.papel === "gestor");
const logado    = () => !!S.user;

/* ============================ utilitários ============================ */
const el = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n1 = v => v==null||isNaN(v) ? "—" : (Math.round(v*10)/10).toFixed(1).replace(".",",");
const n2 = v => v==null||isNaN(v) ? "—" : (Math.round(v*100)/100).toFixed(2).replace(".",",");
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40) || ("s"+Date.now());
const hoje = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0") };
const dataBR = s => { const m=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?`${m[3]}/${m[2]}/${m[1]}`:"—" };
const setorDe = id => S.setores.find(x => x.id === id) || null;

function faixa(v){
  if (v == null) return { cls:"nt", txt:"Sem auditoria" };
  if (v >= 9) return { cls:"ok", txt:"Excelente" };
  if (v >= S.cfg.objetivo) return { cls:"ok", txt:"No objetivo" };
  return { cls:"cr", txt:"Abaixo do objetivo" };
}
const doPeriodo = p => S.resultados.filter(r => r.periodo === p);
function ponderado(rows){
  const porArea = {};
  rows.forEach(r => (porArea[r.area] = porArea[r.area] || []).push(r.resultado));
  let tot = 0, pu = 0;
  (S.cfg.pesos || []).forEach(w => {
    const arr = porArea[w.area];
    if (!arr || !arr.length) return;
    tot += (arr.reduce((x,y) => x+y, 0) / arr.length) * w.peso;
    pu += w.peso;
  });
  return pu ? tot/pu : null;
}
function periodos(){
  const set = {}; S.resultados.forEach(r => set[r.periodo] = 1);
  const arr = Object.keys(set).sort();
  if (!arr.length){ const d = new Date(); arr.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-S1") }
  return arr;
}
// resumo público gravado junto com a auditoria
function resumoDe(aud){
  const r = {
    setorId:aud.setorId, setorNome:aud.setorNome, area:aud.area, periodo:aud.periodo,
    data:aud.data || "", resultado:+resultado(aud.scores).toFixed(4),
    nc:contaNC(aud.scores, S.cfg.limiteNC), itens:preenchidos(aud.scores),
    atualizadoEm:new Date().toISOString()
  };
  for (let s = 1; s <= 5; s++) r["s"+s] = +blocoTotal(aud.scores, s).total.toFixed(4);
  return r;
}

/* ============================ tooltip ============================ */
let TIP = null;
const tipShow = (e, html) => { TIP = TIP || el("tip"); TIP.innerHTML = html; TIP.style.opacity = "1"; tipMove(e) };
function tipMove(e){
  if (!TIP || TIP.style.opacity !== "1") return;
  const r = TIP.getBoundingClientRect();
  let x = e.clientX+14, y = e.clientY+14;
  if (x + r.width  > innerWidth  - 8) x = e.clientX - r.width  - 14;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
  TIP.style.left = Math.max(8,x)+"px"; TIP.style.top = Math.max(8,y)+"px";
}
const tipHide = () => { if (TIP) TIP.style.opacity = "0" };
function bindTips(root){
  root.querySelectorAll("[data-tip]").forEach(g => {
    g.addEventListener("mouseenter", e => tipShow(e, g.getAttribute("data-tip")));
    g.addEventListener("mousemove", tipMove);
    g.addEventListener("mouseleave", tipHide);
    g.addEventListener("focus", () => { const b = g.getBoundingClientRect(); tipShow({clientX:b.left+20, clientY:b.top+20}, g.getAttribute("data-tip")) });
    g.addEventListener("blur", tipHide);
  });
}

/* ============================ gráficos ============================ */
function chartRanking(rows){
  if (!rows.length) return '<div class="empty">Sem auditorias neste período.</div>';
  const W = 760, LB = innerWidth < 700 ? 118 : 190, RB = 52, bh = 20, gap = 8;
  const H = rows.length*(bh+gap)+34, x0 = LB, xw = W-LB-RB, obj = S.cfg.objetivo, o = [];
  o.push(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ranking de setores pelo resultado 5S">`);
  for (let g = 0; g <= 10; g += 2){
    const gx = x0+xw*g/10;
    o.push(`<line x1="${gx}" y1="18" x2="${gx}" y2="${H-16}" stroke="#EDEDED"/>`,
           `<text x="${gx}" y="12" font-size="10" fill="#8A8A8A" text-anchor="middle">${g}</text>`);
  }
  const corte = LB > 150 ? 30 : 18;
  rows.forEach((r, i) => {
    const y = 24+i*(bh+gap), w = Math.max(2, xw*Math.min(r.v,10)/10), low = r.v < obj;
    const tip = `<b>${esc(r.nome)}</b><br>Resultado ${n2(r.v)} · objetivo ${n1(obj)}<br>${esc(r.area)}`.replace(/"/g,"&quot;");
    o.push(`<g data-tip="${tip}" tabindex="0">`,
      `<rect x="${x0}" y="${y}" width="${xw}" height="${bh}" fill="#F7F7F5"/>`,
      `<rect x="${x0}" y="${y}" width="${w}" height="${bh}" rx="3" fill="#739630"/>`,
      `<text x="${x0-10}" y="${y+bh/2+4}" font-size="11.5" fill="${low?"#8A2433":"#333"}" text-anchor="end" font-weight="${low?600:500}">${esc(r.nome.length>corte?r.nome.slice(0,corte-1)+"…":r.nome)}</text>`,
      `<text x="${x0+xw+8}" y="${y+bh/2+4}" font-size="12" fill="#024F2B" font-weight="700">${n2(r.v)}</text>`);
    if (low) o.push(`<circle cx="${x0+w+7}" cy="${y+bh/2}" r="3.5" fill="#D1495B"/>`);
    o.push("</g>");
  });
  const ox = x0+xw*Math.min(obj,10)/10;
  o.push(`<line x1="${ox}" y1="18" x2="${ox}" y2="${H-16}" stroke="#D1495B" stroke-width="1.5" stroke-dasharray="4 3"/>`,
    `<text x="${ox}" y="${H-4}" font-size="10" fill="#8A2433" text-anchor="middle" font-weight="600">objetivo ${n1(obj)}</text>`,
    "</svg>",
    '<div class="lgd"><span><i style="background:#739630"></i>Resultado do setor (0–10)</span><span><i style="background:#D1495B;border-radius:9999px"></i>Abaixo do objetivo</span></div>');
  let t = '<details class="tv"><summary>Ver como tabela</summary><div class="tblwrap"><table><thead><tr><th>Setor</th><th>Área</th><th class="num">Resultado</th><th>Situação</th></tr></thead><tbody>';
  rows.forEach(r => { const f = faixa(r.v);
    t += `<tr><td class="strong">${esc(r.nome)}</td><td>${esc(r.area)}</td><td class="num strong">${n2(r.v)}</td><td><span class="chip ${f.cls}"><i class="dot"></i>${f.txt}</span></td></tr>` });
  return o.join("")+t+"</tbody></table></div></details>";
}
function chartPorS(med){
  const W = 760, H = 220, LB = 34, BB = 46, x0 = LB, xw = W-LB-14, bw = xw/5, o = [];
  o.push(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Média de cada senso">`);
  for (let g = 0; g <= 10; g += 2){
    const gy = H-BB-(H-BB-26)*g/10;
    o.push(`<line x1="${x0}" y1="${gy}" x2="${W-14}" y2="${gy}" stroke="#EDEDED"/>`,
           `<text x="${x0-8}" y="${gy+4}" font-size="10" fill="#8A8A8A" text-anchor="end">${g}</text>`);
  }
  for (let s = 1; s <= 5; s++){
    const v = med[s], bx = x0+bw*(s-1)+13, w = bw-26;
    const hh = v == null ? 0 : (H-BB-26)*Math.min(v,10)/10, y = H-BB-hh;
    const tip = `<b>${s}S — ${S_INFO[s].nome}</b><br>${S_INFO[s].jp}<br>Média ${n2(v)}`.replace(/"/g,"&quot;");
    o.push(`<g data-tip="${tip}" tabindex="0">`,
      `<rect x="${bx}" y="26" width="${w}" height="${H-BB-26}" fill="#F7F7F5"/>`);
    if (v != null) o.push(`<rect x="${bx}" y="${y}" width="${w}" height="${hh}" rx="3" fill="#739630"/>`);
    o.push(`<text x="${bx+w/2}" y="${y-7}" font-size="13" font-weight="700" fill="#024F2B" text-anchor="middle">${n2(v)}</text>`,
      `<text x="${bx+w/2}" y="${H-BB+17}" font-size="12" font-weight="700" fill="#024F2B" text-anchor="middle">${s}S · ${esc(S_INFO[s].nome)}</text>`,
      `<text x="${bx+w/2}" y="${H-BB+31}" font-size="10" fill="#8A8A8A" text-anchor="middle" letter-spacing="0.08em">${esc(S_INFO[s].jp.toUpperCase())}</text>`,
      "</g>");
  }
  const oy = H-BB-(H-BB-26)*Math.min(S.cfg.objetivo,10)/10;
  o.push(`<line x1="${x0}" y1="${oy}" x2="${W-14}" y2="${oy}" stroke="#D1495B" stroke-width="1.5" stroke-dasharray="4 3"/>`,
    `<text x="${W-16}" y="${oy-6}" font-size="10" fill="#8A2433" text-anchor="end" font-weight="600">objetivo ${n1(S.cfg.objetivo)}</text>`,
    "</svg>");
  return o.join("");
}
function chartEvolucao(pts){
  if (pts.length < 2) return '<div class="empty">A evolução aparece quando houver pelo menos dois períodos lançados.</div>';
  const W = 760, H = 230, L = 34, R = 16, T = 22, B = 42, xw = W-L-R, yh = H-T-B, o = [];
  const X = i => L + xw*i/(pts.length-1);
  const Y = v => T + yh - yh*Math.min(v,10)/10;
  o.push(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do resultado ponderado">`);
  for (let g = 0; g <= 10; g += 2)
    o.push(`<line x1="${L}" y1="${Y(g)}" x2="${W-R}" y2="${Y(g)}" stroke="#EDEDED"/><text x="${L-8}" y="${Y(g)+4}" font-size="10" fill="#8A8A8A" text-anchor="end">${g}</text>`);
  o.push(`<line x1="${L}" y1="${Y(S.cfg.objetivo)}" x2="${W-R}" y2="${Y(S.cfg.objetivo)}" stroke="#D1495B" stroke-width="1.5" stroke-dasharray="4 3"/>`,
    `<text x="${W-R}" y="${Y(S.cfg.objetivo)-6}" font-size="10" fill="#8A2433" text-anchor="end" font-weight="600">objetivo ${n1(S.cfg.objetivo)}</text>`,
    `<path d="${pts.map((p,i) => (i?"L":"M")+X(i)+" "+Y(p.v)).join(" ")}" fill="none" stroke="#739630" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
  pts.forEach((p, i) => {
    const tip = `<b>${esc(periodoLabel(p.p))}</b><br>Ponderado ${n2(p.v)}<br>${p.q} setores auditados`.replace(/"/g,"&quot;");
    const partes = periodoLabel(p.p).split(" · ");
    o.push(`<g data-tip="${tip}" tabindex="0">`,
      `<circle cx="${X(i)}" cy="${Y(p.v)}" r="9" fill="transparent"/>`,
      `<circle cx="${X(i)}" cy="${Y(p.v)}" r="5" fill="#739630" stroke="#fff" stroke-width="2"/>`,
      `<text x="${X(i)}" y="${Y(p.v)-12}" font-size="11.5" font-weight="700" fill="#024F2B" text-anchor="middle">${n2(p.v)}</text>`,
      `<text x="${X(i)}" y="${H-B+16}" font-size="10" fill="#666" text-anchor="middle">${esc(partes[0]||"")}</text>`,
      `<text x="${X(i)}" y="${H-B+29}" font-size="10" fill="#8A8A8A" text-anchor="middle">${esc(partes[1]||"")}</text>`,
      "</g>");
  });
  return o.join("")+"</svg>";
}

/* ============================ views ============================ */
function viewPainel(){
  const p = S.periodo, rows0 = doPeriodo(p), obj = S.cfg.objetivo;
  const pond = ponderado(rows0);
  const rows = rows0.map(r => ({ nome:r.setorNome, area:r.area, v:r.resultado })).sort((a,b) => b.v-a.v);
  const abaixo = rows.filter(r => r.v < obj);
  const med = {};
  for (let s = 1; s <= 5; s++){
    const vs = rows0.map(r => r["s"+s]).filter(v => v != null);
    med[s] = vs.length ? vs.reduce((x,y) => x+y, 0)/vs.length : null;
  }
  const ncTotal = rows0.reduce((t,r) => t + (r.nc||0), 0);
  const abertas = S.acoes.filter(x => x.status !== "Concluída" && x.status !== "Cancelada").length;

  let h = '<div class="grid g4" style="margin-bottom:var(--s6)">';
  h += `<div class="tile hero"><div class="k">Resultado ponderado</div><div class="v">${n2(pond)} <small>/ 10</small></div><div class="m">${pond==null?"sem dados":(pond>=obj?"acima do objetivo de "+n1(obj):"abaixo do objetivo de "+n1(obj))}</div></div>`;
  h += `<div class="tile"><div class="k">Setores auditados</div><div class="v">${rows0.length} <small>/ ${S.setores.length}</small></div><div class="m">${esc(periodoLabel(p))}</div></div>`;
  h += `<div class="tile"><div class="k">Abaixo do objetivo</div><div class="v" style="color:${abaixo.length?"#D1495B":"#024F2B"}">${abaixo.length}</div><div class="m">${abaixo.length?esc(abaixo.slice(0,3).map(r=>r.nome).join(", "))+(abaixo.length>3?" +"+(abaixo.length-3):""):"nenhum setor"}</div></div>`;
  h += logado()
    ? `<div class="tile"><div class="k">Ações em aberto</div><div class="v">${abertas}</div><div class="m">no plano de ação</div></div>`
    : `<div class="tile"><div class="k">Não conformidades</div><div class="v">${ncTotal}</div><div class="m">itens com nota até ${S.cfg.limiteNC} no período</div></div>`;
  h += "</div>";

  h += '<div class="grid g2" style="margin-bottom:var(--s6)">';
  (S.cfg.pesos || []).forEach(w => {
    const arr = rows0.filter(r => r.area === w.area);
    const m = arr.length ? arr.reduce((t,r) => t+r.resultado, 0)/arr.length : null;
    const f = faixa(m);
    h += `<div class="card"><h2>${esc(w.area)}</h2><div class="hint">Peso ${n1(w.peso)} na média geral · ${arr.length} setor(es) auditado(s)</div>
      <div style="display:flex;align-items:baseline;gap:12px"><div style="font-size:34px;line-height:38px;font-weight:700;color:var(--tinta);font-variant-numeric:tabular-nums">${n2(m)}</div><span class="chip ${f.cls}"><i class="dot"></i>${f.txt}</span></div>
      <div class="hint" style="margin:8px 0 0">Contribuição ponderada: <b>${n2(m==null?null:m*w.peso)}</b></div></div>`;
  });
  h += "</div>";

  h += `<div class="card" style="margin-bottom:var(--s6)"><h2>Ranking por setor</h2><div class="hint">Resultado 5S de cada setor no período, do melhor para o pior. A linha tracejada é o objetivo.</div>${chartRanking(rows)}</div>`;
  h += `<div class="card" style="margin-bottom:var(--s6)"><h2>Média de cada senso</h2><div class="hint">Onde o programa está mais forte e mais fraco neste período.</div>${chartPorS(med)}</div>`;

  const pts = periodos().map(pp => { const rr = doPeriodo(pp), v = ponderado(rr); return v==null?null:{p:pp, v, q:rr.length} }).filter(Boolean);
  h += `<div class="card" style="margin-bottom:var(--s6)"><h2>Evolução</h2><div class="hint">Resultado ponderado da indústria em cada período lançado.</div>${chartEvolucao(pts)}</div>`;

  h += `<div class="card"><h2>Exportar</h2><div class="hint">Relatório do período com o consolidado, o ranking e${logado()?" o plano de ação em aberto":" a média de cada senso"}.</div>
    <div class="btnrow"><button class="btn" data-pdfper="1"${rows0.length?"":" disabled"}>Baixar relatório em PDF</button>
    <button class="btn gho" data-csv="1"${rows0.length?"":" disabled"}>Copiar tabela (CSV)</button></div></div>`;
  return h;
}

function viewAuditorias(){
  const p = S.periodo;
  let h = '<div class="filtros">';
  h += `<label class="f"><span>Setor</span><select class="inp" data-faud="setor"><option value="">Todos os setores</option>${S.setores.map(s => `<option value="${s.id}"${S.fAud.setor===s.id?" selected":""}>${esc(s.nome)}</option>`).join("")}</select></label>`;
  h += '<div style="flex:1 1 auto"></div>';
  h += podeLancar() ? '<button class="btn" data-nova="1">+ Nova auditoria</button>'
                    : '<button class="btn sec" data-login="1">Entrar para lançar</button>';
  h += "</div>";

  const rows = doPeriodo(p).filter(r => !S.fAud.setor || r.setorId === S.fAud.setor);
  const pendentes = S.setores.filter(s => !doPeriodo(p).some(r => r.setorId === s.id));

  if (!rows.length){
    h += `<div class="card"><div class="empty"><b>Nenhuma auditoria lançada em ${esc(periodoLabel(p))}</b>${podeLancar()?"Toque em “Nova auditoria”, escolha o setor e preencha os 25 itens.":"Entre com seu usuário de auditor para lançar."}</div></div>`;
  } else {
    h += `<div class="card"><h2>Auditorias de ${esc(periodoLabel(p))}</h2><div class="hint">${rows.length} lançamento(s).${logado()?" Toque em uma linha para abrir.":" Entre para ver as observações e o detalhe item a item."}</div>
      <div class="tblwrap"><table><thead><tr><th>Setor</th><th>Área</th><th>Data</th><th class="num">1S</th><th class="num">2S</th><th class="num">3S</th><th class="num">4S</th><th class="num">5S</th><th class="num">Resultado</th><th>Situação</th><th class="num">NC</th>${logado()?"<th></th>":""}</tr></thead><tbody>`;
    rows.slice().sort((a,b) => b.resultado-a.resultado).forEach(r => {
      const f = faixa(r.resultado);
      h += `<tr${logado()?` style="cursor:pointer" data-abrir="${esc(r.id)}"`:""}><td class="strong">${esc(r.setorNome)}</td><td>${esc(r.area)}</td><td>${dataBR(r.data)}</td>`;
      for (let s = 1; s <= 5; s++) h += `<td class="num">${n1(r["s"+s])}</td>`;
      h += `<td class="num strong">${n2(r.resultado)}</td><td><span class="chip ${f.cls}"><i class="dot"></i>${f.txt}</span></td>`;
      h += `<td class="num">${r.nc ? `<span class="chip cr"><i class="dot"></i>${r.nc}</span>` : "0"}</td>`;
      if (logado()) h += `<td><button class="btn gho sm" data-pdfaud="${esc(r.id)}">PDF</button></td>`;
      h += "</tr>";
    });
    h += "</tbody></table></div></div>";
  }
  if (pendentes.length){
    h += `<div class="card" style="margin-top:var(--s6)"><h2>Ainda sem auditoria neste período</h2><div class="hint">${pendentes.length} setor(es).</div><div class="btnrow">${
      pendentes.map(s => `<button class="btn sec sm" data-nova="${esc(s.id)}"${podeLancar()?"":" disabled"}>${esc(s.nome)}</button>`).join("")}</div></div>`;
  }
  return h;
}

function viewAcoes(){
  if (!logado()) return `<div class="card"><div class="empty"><b>Plano de ação restrito</b>As não conformidades e as tratativas só aparecem para quem está logado.<div class="btnrow" style="justify-content:center;margin-top:var(--s4)"><button class="btn" data-login="1">Entrar</button></div></div></div>`;

  const lim = S.cfg.limiteNC, ncs = [];
  S.auditorias.forEach(a => {
    for (let i = 1; i <= 25; i++){
      if (a.scores[i] != null && a.scores[i] <= lim){
        const id = a.id+"__"+i;
        if (!S.acoes.some(x => x.id === id)) ncs.push({ id, aud:a, item:i, nota:a.scores[i] });
      }
    }
  });

  let h = '<div class="filtros">';
  h += `<label class="f"><span>Setor</span><select class="inp" data-fac="setor"><option value="">Todos</option>${S.setores.map(s => `<option value="${s.id}"${S.fAcao.setor===s.id?" selected":""}>${esc(s.nome)}</option>`).join("")}</select></label>`;
  h += `<label class="f"><span>Status</span><select class="inp" data-fac="status"><option value="">Todos</option>${ACAO_STATUS.map(s => `<option${S.fAcao.status===s?" selected":""}>${s}</option>`).join("")}</select></label>`;
  h += "</div>";

  if (ncs.length){
    const nf = ncs.filter(x => !S.fAcao.setor || x.aud.setorId === S.fAcao.setor);
    h += `<div class="card" style="margin-bottom:var(--s6);border-left:4px solid var(--critico)"><h2>Não conformidades sem ação</h2><div class="hint">Itens com nota até ${lim} que ainda não têm tratativa. ${nf.length} pendente(s).</div>`;
    if (!nf.length) h += '<div class="hint">Nenhuma para o filtro escolhido.</div>';
    else {
      h += '<div class="tblwrap"><table><thead><tr><th>Setor</th><th>Período</th><th>Item</th><th class="num">Nota</th><th></th></tr></thead><tbody>';
      nf.slice(0,150).forEach(x => {
        const it = S.checklist.find(c => c.n === x.item) || { d:"Item "+x.item, s:0 };
        h += `<tr><td class="strong">${esc(x.aud.setorNome)}</td><td>${esc(periodoLabel(x.aud.periodo))}</td>
          <td><span class="pill">${it.s}S · item ${x.item}</span><div style="font-size:13px;line-height:19px;margin-top:3px;max-width:430px">${esc(it.d)}</div>${
            x.aud.obs?.[x.item] ? `<div style="font-size:12px;color:var(--cinza);margin-top:3px">Obs.: ${esc(x.aud.obs[x.item])}</div>` : ""}</td>
          <td class="num"><span class="chip cr"><i class="dot"></i>${x.nota}</span></td>
          <td><button class="btn sm" data-criar="${esc(x.id)}"${podeLancar()?"":" disabled"}>Tratar</button></td></tr>`;
      });
      h += "</tbody></table></div>";
    }
    h += "</div>";
  }

  const ac = S.acoes.filter(x => (!S.fAcao.setor || x.setorId === S.fAcao.setor) && (!S.fAcao.status || x.status === S.fAcao.status));
  const hj = hoje();
  h += `<div class="card"><h2>Plano de ação</h2><div class="hint">${ac.length} ação(ões). Atrasada = prazo vencido e ainda não concluída.</div>`;
  if (!ac.length) return h + '<div class="empty"><b>Nenhuma ação cadastrada</b>As não conformidades aparecem acima; toque em “Tratar” para abrir a tratativa.</div></div>';
  h += '<div class="tblwrap"><table><thead><tr><th>Setor</th><th>O quê / Por quê</th><th>Quem</th><th>Prazo</th><th>Status</th><th></th></tr></thead><tbody>';
  ac.slice().sort((a,b) => String(a.prazo||"9").localeCompare(String(b.prazo||"9"))).forEach(x => {
    const atr = x.status !== "Concluída" && x.status !== "Cancelada" && x.prazo && x.prazo < hj;
    const cls = x.status === "Concluída" ? "ok" : (x.status === "Cancelada" ? "nt" : (atr ? "cr" : "at"));
    const it = S.checklist.find(c => c.n === x.item);
    h += `<tr><td class="strong">${esc(x.setorNome)}<div class="pill" style="margin-top:3px">${it?`${it.s}S · item ${x.item}`:"—"}</div></td>
      <td style="max-width:400px"><div style="font-size:14px;line-height:20px">${esc(x.oque||"—")}</div>${x.porque?`<div style="font-size:12px;color:var(--cinza);margin-top:2px">${esc(x.porque)}</div>`:""}</td>
      <td>${esc(x.quem||"—")}</td><td>${dataBR(x.prazo)}</td>
      <td><span class="chip ${cls}"><i class="dot"></i>${esc(atr?"Atrasada":x.status)}</span></td>
      <td><button class="btn gho sm" data-editar="${esc(x.id)}"${podeLancar()?"":" disabled"}>Abrir</button></td></tr>`;
  });
  return h + '</tbody></table></div><div class="btnrow" style="margin-top:var(--s4)"><button class="btn gho sm" data-csvac="1">Copiar plano (CSV)</button></div></div>';
}

function viewConfig(){
  const trava = ehGestor() ? "" : " disabled";
  let h = "";
  if (!ehGestor())
    h += '<div class="banner">Só quem tem papel <b>gestor</b> altera os parâmetros do programa. Você pode conferir os valores abaixo.</div>';
  h += `<div class="card" style="margin-bottom:var(--s6)"><h2>Parâmetros</h2><div class="hint">Objetivo e pesos usados no cálculo do resultado ponderado.</div><div class="grid g4">
    <label class="f"><span>Objetivo</span><input class="inp" type="number" step="0.1" min="0" max="10" value="${S.cfg.objetivo}" data-cfg="objetivo"${trava}></label>`;
  (S.cfg.pesos||[]).forEach((w,i) => { h += `<label class="f"><span>Peso · ${esc(w.area)}</span><input class="inp" type="number" step="0.05" min="0" max="1" value="${w.peso}" data-peso="${i}"${trava}></label>` });
  h += `<label class="f"><span>Nota máx. de NC</span><input class="inp" type="number" step="1" min="0" max="5" value="${S.cfg.limiteNC}" data-cfg="limiteNC"${trava}></label>
    </div><div class="btnrow"><button class="btn" data-salvarcfg="1"${trava}>Salvar parâmetros</button></div></div>`;

  h += `<div class="card" style="margin-bottom:var(--s6)"><h2>Setores</h2><div class="hint">A área define o peso do setor na média geral.</div><div class="tblwrap"><table><thead><tr><th>Setor</th><th>Área</th><th></th></tr></thead><tbody>`;
  S.setores.forEach((s,i) => {
    h += `<tr><td><input class="inp" value="${esc(s.nome)}" data-setnome="${i}"${trava}></td>
      <td><select class="inp" data-setarea="${i}"${trava}>${[AP,AD].map(a => `<option${s.area===a?" selected":""}>${a}</option>`).join("")}</select></td>
      <td><button class="btn gho sm" data-delset="${i}"${trava}>Remover</button></td></tr>`;
  });
  h += `</tbody></table></div><div class="btnrow" style="margin-top:var(--s4)"><button class="btn sec sm" data-addset="1"${trava}>+ Adicionar setor</button><button class="btn" data-salvarset="1"${trava}>Salvar setores</button></div></div>`;

  h += `<div class="card"><h2>Acesso</h2><div class="hint">Quem pode lançar auditoria.</div>
    <div style="font-size:14px;line-height:21px">O painel é aberto: qualquer pessoa com o link vê os resultados. Observações e plano de ação exigem login, e só lança quem está cadastrado como auditor.</div>
    <div class="cad">Para liberar uma pessoa: Firebase ▸ Authentication ▸ Add user (e-mail e senha) ▸ copie o UID ▸ Firestore ▸ coleção <b>usuarios</b> ▸ documento com esse UID, campos <b>nome</b> e <b>papel</b> (<i>auditor</i> ou <i>gestor</i>).</div></div>`;
  return h;
}

/* ============================ formulário de auditoria ============================ */
function abrirForm(audId, setorId){
  const a = audId ? S.auditorias.find(x => x.id === audId) : null;
  if (audId && !a){ aviso("Não foi possível abrir: a auditoria ainda não carregou.", true); return }
  const pm = String(S.periodo||"").match(/^(\d{4})-(\d{2})-S(\d)$/) || [];
  S.form = a ? JSON.parse(JSON.stringify(a)) : {
    id:null, setorId:setorId||"", setorNome:"", area:"", periodo:S.periodo,
    ano:+(pm[1]||new Date().getFullYear()), mes:+(pm[2]||new Date().getMonth()+1), semana:+(pm[3]||1),
    data:hoje(), auditores:"", scores:{}, obs:{}
  };
  if (a){
    const am = String(a.periodo||"").match(/^(\d{4})-(\d{2})-S(\d)$/);
    S.form.ano = +(am?am[1]:new Date().getFullYear()); S.form.mes = +(am?am[2]:1); S.form.semana = +(am?am[3]:1);
  } else if (setorId){
    const st = setorDe(setorId);
    if (st){ S.form.setorNome = st.nome; S.form.area = st.area }
  }
  renderForm();
}
function fecharForm(){
  S.form = null;
  document.querySelector(".ovl.form")?.remove();
  document.body.style.overflow = "";
  render();
}
function renderForm(){
  const f = S.form; if (!f) return;
  let o = document.querySelector(".ovl.form");
  if (!o){ o = document.createElement("div"); o.className = "ovl form"; document.body.appendChild(o); document.body.style.overflow = "hidden" }
  const done = preenchidos(f.scores), res = resultado(f.scores);
  let h = `<div class="sheet"><div class="top"><div style="flex:1 1 auto;min-width:0"><h2>${f.id?"Auditoria — "+esc(f.setorNome):"Nova auditoria"}</h2><div class="sub">${esc(periodoLabel(f.periodo))} · ${done} de 25 itens · resultado ${n2(res)}</div></div><button class="xbtn" data-fechar="1" aria-label="Fechar">×</button></div><div class="body">`;
  h += `<div class="card" style="margin-bottom:var(--s4)"><h2>Identificação</h2><div class="grid g4">
    <label class="f"><span>Setor</span><select class="inp" data-fset="1"><option value="">Escolha…</option>${S.setores.map(s => `<option value="${s.id}"${f.setorId===s.id?" selected":""}>${esc(s.nome)}</option>`).join("")}</select></label>
    <label class="f"><span>Ano</span><input class="inp" type="number" min="2020" max="2100" value="${f.ano}" data-fper="ano"></label>
    <label class="f"><span>Mês</span><select class="inp" data-fper="mes">${MESES.map((m,i) => `<option value="${i+1}"${f.mes===i+1?" selected":""}>${m}</option>`).join("")}</select></label>
    <label class="f"><span>Semana</span><select class="inp" data-fper="semana">${[1,2,3,4,5].map(w => `<option value="${w}"${f.semana===w?" selected":""}>${w}ª semana</option>`).join("")}</select></label>
    <label class="f"><span>Data da auditoria</span><input class="inp" type="date" value="${esc(f.data||"")}" data-fcab="data"></label>
    <label class="f wide"><span>Auditores</span><input class="inp" value="${esc(f.auditores||"")}" placeholder="Nomes separados por /" data-fcab="auditores"></label>
    </div></div>`;
  for (let s = 1; s <= 5; s++){
    const bt = blocoTotal(f.scores, s);
    h += `<div class="bloco"><header><div class="sbadge">${s}S</div><div class="bt"><b>${esc(S_INFO[s].nome)}</b><span>${esc(S_INFO[s].jp)} · ${bt.preenchidos}/5 itens</span></div><div class="bn">${n1(bt.total)}<small> /10</small></div></header>`;
    S.checklist.filter(c => c.s === s).forEach(c => {
      const v = f.scores[c.n], low = v != null && v <= S.cfg.limiteNC;
      h += `<div class="item"><div class="ih"><span class="n">${c.n}</span><span class="ci">${esc(c.ci)}</span></div><div class="d">${esc(c.d)}</div><div class="scale">`;
      for (let k = 0; k <= 5; k++)
        h += `<button class="sc${k<=S.cfg.limiteNC?" low":""}" data-nota="${c.n}|${k}" aria-pressed="${v===k}"><b>${k}</b><i>${esc(LEG[k])}</i></button>`;
      h += "</div>";
      if (low) h += '<div class="nc"><span class="chip cr"><i class="dot"></i>Gera não conformidade</span></div>';
      h += `<div class="obsrow"><textarea class="inp" placeholder="Observação / evidência (opcional)" data-fobs="${c.n}">${esc(f.obs?.[c.n]||"")}</textarea></div></div>`;
    });
    h += "</div>";
  }
  h += `</div><div class="foot"><div style="flex:1 1 auto;font-size:13px;color:var(--cinza)">${done}/25 itens · <b style="color:var(--tinta)">resultado ${n2(res)}</b></div>
    <button class="btn gho" data-fechar="1">Cancelar</button>`;
  if (f.id) h += '<button class="btn gho" data-excluir="1" style="color:#8A2433;border-color:#E6C2C8">Excluir</button>';
  h += `<button class="btn" data-salvar="1"${(!f.setorId||!podeLancar())?" disabled":""}>Salvar auditoria</button></div></div>`;
  o.innerHTML = h;
}

/* ============================ avisos e diálogos ============================ */
function aviso(txt, erro){
  const v = el("view"), b = document.createElement("div");
  b.className = "banner" + (erro ? " erro" : " ok");
  b.textContent = txt;
  v.insertBefore(b, v.firstChild);
  setTimeout(() => b.remove(), erro ? 9000 : 4500);
}
function dialogo(titulo, corpoHtml, onOk, okTxt){
  const d = document.createElement("div");
  d.className = "ovl mid";
  d.innerHTML = `<div class="card" style="max-width:560px;width:100%;max-height:90vh;overflow:auto"><h2>${esc(titulo)}</h2><div style="margin:12px 0">${corpoHtml}</div><div class="btnrow" style="justify-content:flex-end"><button class="btn gho" data-dcancel="1">Cancelar</button><button class="btn" data-dok="1">${esc(okTxt||"Confirmar")}</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", e => {
    if (e.target.closest("[data-dcancel]")) return d.remove();
    if (e.target.closest("[data-dok]") && onOk(d) !== false) d.remove();
  });
  return d;
}
function formAcao(ac, novo){
  const it = S.checklist.find(c => c.n === ac.item);
  let corpo = `<div class="pill" style="margin-bottom:8px">${esc(ac.setorNome)}${it?` · ${it.s}S · item ${ac.item}`:""}</div>`;
  if (it) corpo += `<div style="font-size:13px;line-height:19px;color:#333;margin-bottom:12px">${esc(it.d)}</div>`;
  corpo += `<label class="f"><span>O que será feito</span><textarea class="inp" id="ac_oque">${esc(ac.oque||"")}</textarea></label>
    <label class="f"><span>Por que / causa</span><textarea class="inp" id="ac_porque">${esc(ac.porque||"")}</textarea></label>
    <div class="grid g2"><label class="f"><span>Responsável</span><input class="inp" id="ac_quem" value="${esc(ac.quem||"")}"></label>
    <label class="f"><span>Prazo</span><input class="inp" type="date" id="ac_prazo" value="${esc(ac.prazo||"")}"></label></div>
    <div class="grid g2"><label class="f"><span>Status</span><select class="inp" id="ac_status">${ACAO_STATUS.map(s => `<option${(ac.status||"Aberta")===s?" selected":""}>${s}</option>`).join("")}</select></label>
    <label class="f"><span>Evidência da conclusão</span><input class="inp" id="ac_ev" value="${esc(ac.evidencia||"")}"></label></div>`;
  dialogo(novo ? "Tratar não conformidade" : "Ação corretiva", corpo, d => {
    ac.oque = d.querySelector("#ac_oque").value.trim();
    if (!ac.oque){ aviso("Descreva o que será feito.", true); return false }
    ac.porque = d.querySelector("#ac_porque").value.trim();
    ac.quem = d.querySelector("#ac_quem").value.trim();
    ac.prazo = d.querySelector("#ac_prazo").value;
    ac.status = d.querySelector("#ac_status").value;
    ac.evidencia = d.querySelector("#ac_ev").value.trim();
    ac.atualizadoEm = new Date().toISOString();
    ac.atualizadoPor = S.user?.uid || "";
    salvarAcao(ac);
  }, "Salvar ação");
}
function telaLogin(){
  if (S.semBanco){ aviso("O Firebase ainda não foi configurado neste site (js/firebase-config.js).", true); return }
  const d = document.createElement("div");
  d.className = "ovl mid";
  d.innerHTML = `<div class="login">
    <div class="mk"><img src="assets/logo.svg" alt=""><h2>Entrar</h2></div>
    <div class="hint">Acesso para auditores do Programa 5S. O painel de resultados é aberto e não precisa de login.</div>
    <div id="lgmsg"></div>
    <label class="f"><span>E-mail</span><input class="inp" type="email" id="lg_email" autocomplete="username" inputmode="email"></label>
    <label class="f"><span>Senha</span><input class="inp" type="password" id="lg_senha" autocomplete="current-password"></label>
    <div class="btnrow" style="justify-content:space-between">
      <button class="linkbtn" id="lg_reset">Esqueci minha senha</button>
      <span><button class="btn gho" id="lg_cancel">Cancelar</button> <button class="btn" id="lg_ok">Entrar</button></span>
    </div></div>`;
  document.body.appendChild(d);
  const msg = (t, ok) => d.querySelector("#lgmsg").innerHTML = `<div class="msg${ok?" ok":""}">${esc(t)}</div>`;
  const fechar = () => d.remove();
  d.querySelector("#lg_cancel").onclick = fechar;
  d.addEventListener("keydown", e => { if (e.key === "Enter") d.querySelector("#lg_ok").click(); if (e.key === "Escape") fechar() });
  d.querySelector("#lg_ok").onclick = async () => {
    const email = d.querySelector("#lg_email").value.trim(), senha = d.querySelector("#lg_senha").value;
    if (!email || !senha) return msg("Preencha e-mail e senha.");
    d.querySelector("#lg_ok").disabled = true;
    try { await signInWithEmailAndPassword(S.auth, email, senha); fechar() }
    catch (e){
      d.querySelector("#lg_ok").disabled = false;
      const m = { "auth/invalid-credential":"E-mail ou senha incorretos.", "auth/wrong-password":"E-mail ou senha incorretos.",
                  "auth/user-not-found":"Não há usuário com esse e-mail.", "auth/too-many-requests":"Muitas tentativas. Aguarde alguns minutos.",
                  "auth/invalid-email":"E-mail inválido.", "auth/network-request-failed":"Sem conexão com o servidor." };
      msg(m[e.code] || ("Não foi possível entrar (" + e.code + ")."));
    }
  };
  d.querySelector("#lg_reset").onclick = async () => {
    const email = d.querySelector("#lg_email").value.trim();
    if (!email) return msg("Escreva seu e-mail acima e toque de novo.");
    try { await sendPasswordResetEmail(S.auth, email); msg("Enviamos um link de redefinição para " + email + ".", true) }
    catch { msg("Não foi possível enviar o link para esse e-mail.") }
  };
  setTimeout(() => d.querySelector("#lg_email").focus(), 50);
}

/* ============================ gravação ============================ */
function tratarErro(e){
  if (e?.code === "permission-denied"){
    aviso("Seu usuário não tem permissão para gravar. Peça ao responsável para cadastrar você como auditor.", true);
  } else {
    aviso("Não foi possível salvar agora (" + (e?.code || "erro") + "). Tente de novo em alguns segundos.", true);
  }
  console.error(e);
}
async function salvarAuditoria(){
  const f = S.form;
  if (!f?.setorId || !S.db) return;
  const st = setorDe(f.setorId);
  const periodo = `${f.ano}-${String(f.mes).padStart(2,"0")}-S${f.semana}`;
  const id = f.id || `${periodo}__${f.setorId}`;
  const base = {
    setorId:f.setorId, setorNome:st?st.nome:f.setorId, area:st?st.area:f.area, periodo,
    ano:f.ano, mes:f.mes, semana:f.semana, data:f.data || "",
    atualizadoEm:new Date().toISOString(), atualizadoPor:S.user?.uid || ""
  };
  try {
    const lote = writeBatch(S.db);
    lote.set(doc(S.db, "auditorias", id), { ...base, auditores:f.auditores||"", scores:f.scores||{}, obs:f.obs||{} });
    lote.set(doc(S.db, "resultados", id), { ...base, ...resumoDe({ ...base, scores:f.scores||{} }) });
    await lote.commit();
    S.periodo = periodo; S.form = null;
    document.querySelector(".ovl.form")?.remove();
    document.body.style.overflow = "";
    render();
    aviso("Auditoria de " + base.setorNome + " salva.");
  } catch (e){ tratarErro(e) }
}
function excluirAuditoria(){
  const f = S.form;
  if (!f?.id || !S.db) return;
  dialogo("Excluir auditoria",
    `<div style="font-size:14px;line-height:21px">A auditoria de <b>${esc(f.setorNome)}</b> em ${esc(periodoLabel(f.periodo))} será removida para todos. As ações já cadastradas continuam no plano de ação.</div>`,
    () => {
      const lote = writeBatch(S.db);
      lote.delete(doc(S.db, "auditorias", f.id));
      lote.delete(doc(S.db, "resultados", f.id));
      lote.commit().then(() => { fecharForm(); aviso("Auditoria excluída.") }, tratarErro);
    }, "Excluir");
}
async function salvarAcao(ac){
  if (!S.db) return;
  try { const { id, ...resto } = ac; await setDoc(doc(S.db, "acoes", id), resto); aviso("Ação salva.") }
  catch (e){ tratarErro(e) }
}
async function salvarCfg(){
  if (!S.db) return;
  try { await setDoc(doc(S.db, "config", "geral"), { objetivo:S.cfg.objetivo, pesos:S.cfg.pesos, limiteNC:S.cfg.limiteNC }); aviso("Parâmetros salvos.") }
  catch (e){ tratarErro(e) }
}
async function salvarSetores(){
  if (!S.db) return;
  try { await setDoc(doc(S.db, "config", "setores"), { lista:S.setores }); aviso("Setores salvos.") }
  catch (e){ tratarErro(e) }
}

/* ============================ CSV ============================ */
function copiar(txt, ok){
  navigator.clipboard.writeText(txt).then(() => aviso(ok), () => aviso("Não foi possível copiar.", true));
}
function csvPeriodo(){
  const rows = doPeriodo(S.periodo);
  const l = [["Periodo","Setor","Area","Data","1S","2S","3S","4S","5S","Resultado","NC","Objetivo"].join(";")];
  rows.forEach(r => l.push([r.periodo, r.setorNome, r.area, r.data, n2(r.s1), n2(r.s2), n2(r.s3), n2(r.s4), n2(r.s5), n2(r.resultado), r.nc ?? "", n1(S.cfg.objetivo)].join(";")));
  l.push("", ["Resultado ponderado", n2(ponderado(rows))].join(";"));
  copiar(l.join("\n"), "Tabela copiada. Cole no Excel e use Dados ▸ Texto para colunas (;).");
}
function csvAcoes(){
  const l = [["Setor","Periodo","Item","O que","Por que","Quem","Prazo","Status","Evidencia"].join(";")];
  S.acoes.forEach(a => l.push([a.setorNome,a.periodo,a.item,a.oque,a.porque||"",a.quem||"",a.prazo||"",a.status,a.evidencia||""]
    .map(x => String(x==null?"":x).replace(/[;\n]/g," ")).join(";")));
  copiar(l.join("\n"), "Plano de ação copiado.");
}

/* ============================ PDF ============================ */
async function exportarPeriodo(btn){
  const rows = doPeriodo(S.periodo);
  if (!rows.length) return;
  const med = {};
  for (let s = 1; s <= 5; s++){
    const vs = rows.map(r => r["s"+s]).filter(v => v != null);
    med[s] = vs.length ? vs.reduce((x,y) => x+y, 0)/vs.length : null;
  }
  // O relatório do período usa só as notas por senso, que são públicas.
  const auds = rows.map(r => {
    const cheia = S.auditorias.find(a => a.id === r.id);
    return {
      setorNome:r.setorNome, area:r.area, periodo:r.periodo, data:r.data,
      notas:[r.s1, r.s2, r.s3, r.s4, r.s5],
      res:r.resultado,
      nc:r.nc != null ? r.nc : (cheia ? contaNC(cheia.scores, S.cfg.limiteNC) : 0)
    };
  });
  if (btn) btn.disabled = true;
  try {
    await pdfPeriodo({ periodo:S.periodo, auds, cfg:S.cfg, ponderado:ponderado(rows), medias:med, acoes:S.acoes });
  } catch (e){ aviso(e.message || "Não foi possível gerar o PDF.", true); console.error(e) }
  finally { if (btn) btn.disabled = false }
}
async function exportarAuditoria(id, btn){
  const a = S.auditorias.find(x => x.id === id);
  if (!a) return aviso("Abra o sistema com seu login para exportar a folha completa.", true);
  if (btn) btn.disabled = true;
  try { await pdfAuditoria(a, S.checklist, S.cfg) }
  catch (e){ aviso(e.message || "Não foi possível gerar o PDF.", true); console.error(e) }
  finally { if (btn) btn.disabled = false }
}

/* ============================ render ============================ */
const TABS = [["painel","Painel"],["auditorias","Auditorias"],["acoes","Plano de ação"],["config","Configurações"]];
function renderTabs(){
  const abertas = S.acoes.filter(x => x.status !== "Concluída" && x.status !== "Cancelada").length;
  let pend = 0;
  S.auditorias.forEach(a => { for (let i = 1; i <= 25; i++)
    if (a.scores[i] != null && a.scores[i] <= S.cfg.limiteNC && !S.acoes.some(x => x.id === a.id+"__"+i)) pend++ });
  el("tabs").innerHTML = TABS.map(t => {
    const c = t[0] === "auditorias" ? doPeriodo(S.periodo).length : (t[0] === "acoes" ? (logado() ? abertas+pend : 0) : 0);
    return `<button class="tab" role="tab" aria-selected="${S.view===t[0]}" data-tab="${t[0]}">${t[1]}${c?`<span class="cnt">${c}</span>`:""}</button>`;
  }).join("");
}
function renderPeriodos(){
  const sel = el("selPeriodo"), ps = periodos();
  if (!S.periodo || !ps.includes(S.periodo)) S.periodo = ps[ps.length-1];
  sel.innerHTML = ps.map(p => `<option value="${p}"${p===S.periodo?" selected":""}>${esc(periodoLabel(p))}</option>`).join("");
}
function renderWho(){
  const w = el("who");
  if (!logado()){ w.innerHTML = '<button class="btn-hd" data-login="1">Entrar</button>'; return }
  const nome = S.perfil?.nome || S.user.email || "Você";
  const papel = S.perfil?.papel === "gestor" ? "Gestor do programa" : (S.perfil?.papel === "auditor" ? "Auditor" : "Sem permissão para lançar");
  w.innerHTML = `<div class="nm"><b>${esc(nome)}</b>${esc(papel)}</div><button class="btn-hd" data-sair="1">Sair</button>`;
}
function render(){
  if (S.form) return;
  renderPeriodos(); renderTabs(); renderWho();
  const v = el("view");
  if (S.loading){
    v.innerHTML = '<div class="card"><div class="skel" style="width:40%;margin-bottom:10px"></div><div class="skel" style="width:70%;margin-bottom:10px"></div><div class="skel" style="width:55%"></div></div>'
      + (S.lento ? '<div class="banner">Os dados estão demorando a chegar. O que aparecer pode estar desatualizado.</div>' : "");
    return;
  }
  let pre = "";
  if (S.semBanco) pre = '<div class="banner erro">Este site ainda não está ligado ao banco de dados. Preencha <b>js/firebase-config.js</b> com os dados do projeto Firebase.</div>';
  else if (logado() && !podeLancar()) pre = '<div class="banner">Você está logado, mas ainda não foi cadastrado como auditor. Você vê tudo, mas não pode lançar.</div>';
  v.innerHTML = pre + (S.view === "painel" ? viewPainel() : S.view === "auditorias" ? viewAuditorias() : S.view === "acoes" ? viewAcoes() : viewConfig());
  bindTips(v);
}

/* ============================ eventos ============================ */
document.addEventListener("click", e => {
  let t;
  if ((t = e.target.closest("[data-tab]"))){ S.view = t.dataset.tab; render(); return }
  if (e.target.closest("[data-login]")){ telaLogin(); return }
  if (e.target.closest("[data-sair]")){ signOut(S.auth); return }
  if ((t = e.target.closest("[data-nova]"))){ const sid = t.dataset.nova; abrirForm(null, sid === "1" ? "" : sid); return }
  if ((t = e.target.closest("[data-pdfaud]"))){ exportarAuditoria(t.dataset.pdfaud, t); return }
  if ((t = e.target.closest("[data-pdfper]"))){ exportarPeriodo(t); return }
  if ((t = e.target.closest("[data-abrir]"))){ abrirForm(t.dataset.abrir); return }
  if (e.target.closest("[data-fechar]")){ fecharForm(); return }
  if (e.target.closest("[data-salvar]")){ salvarAuditoria(); return }
  if (e.target.closest("[data-excluir]")){ excluirAuditoria(); return }
  if (e.target.closest("[data-csv]")){ csvPeriodo(); return }
  if (e.target.closest("[data-csvac]")){ csvAcoes(); return }
  if ((t = e.target.closest("[data-nota]"))){
    const [n, k] = t.dataset.nota.split("|").map(Number);
    if (S.form){
      if (S.form.scores[n] === k) delete S.form.scores[n]; else S.form.scores[n] = k;
      renderForm();
    }
    return;
  }
  if ((t = e.target.closest("[data-criar]"))){
    const id = t.dataset.criar, corte = id.lastIndexOf("__");
    const aud = S.auditorias.find(x => x.id === id.slice(0, corte));
    if (!aud) return;
    const item = +id.slice(corte+2);
    formAcao({ id, auditoriaId:aud.id, setorId:aud.setorId, setorNome:aud.setorNome, periodo:aud.periodo,
      item, nota:aud.scores[item], status:"Aberta", oque:"", porque:aud.obs?.[item] || "", quem:"", prazo:"",
      evidencia:"", criadoEm:new Date().toISOString() }, true);
    return;
  }
  if ((t = e.target.closest("[data-editar]"))){
    const a = S.acoes.find(x => x.id === t.dataset.editar);
    if (a) formAcao(JSON.parse(JSON.stringify(a)), false);
    return;
  }
  if (e.target.closest("[data-salvarcfg]")){ salvarCfg(); return }
  if (e.target.closest("[data-salvarset]")){ salvarSetores(); return }
  if (e.target.closest("[data-addset]")){ S.setores = [...S.setores, { id:"novo-"+Date.now().toString(36), nome:"Novo setor", area:AP }]; render(); return }
  if ((t = e.target.closest("[data-delset]"))){ const i = +t.dataset.delset; S.setores = S.setores.filter((_, j) => j !== i); render(); return }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "selPeriodo"){ S.periodo = t.value; render(); return }
  if (t.dataset.faud != null){ S.fAud.setor = t.value; render(); return }
  if (t.dataset.fac){ S.fAcao[t.dataset.fac] = t.value; render(); return }
  if (t.dataset.fset && S.form){ const st = setorDe(t.value); S.form.setorId = t.value; S.form.setorNome = st?st.nome:""; S.form.area = st?st.area:""; renderForm(); return }
  if (t.dataset.fper && S.form){ S.form[t.dataset.fper] = +t.value; S.form.periodo = `${S.form.ano}-${String(S.form.mes).padStart(2,"0")}-S${S.form.semana}`; renderForm(); return }
  if (t.dataset.cfg){ S.cfg[t.dataset.cfg] = +t.value; return }
  if (t.dataset.peso != null){ S.cfg.pesos[+t.dataset.peso].peso = +t.value; return }
  if (t.dataset.setarea != null){ S.setores[+t.dataset.setarea].area = t.value; return }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.fobs && S.form){
    const n = +t.dataset.fobs;
    S.form.obs = S.form.obs || {};
    if (t.value.trim()) S.form.obs[n] = t.value; else delete S.form.obs[n];
    return;
  }
  if (t.dataset.fcab && S.form){ S.form[t.dataset.fcab] = t.value; return }
  if (t.dataset.setnome != null){
    const i = +t.dataset.setnome;
    S.setores[i].nome = t.value;
    if (/^novo-/.test(S.setores[i].id)) S.setores[i].id = slug(t.value);
  }
});

/* ============================ início ============================ */
render();
const relogio = setTimeout(() => { if (S.loading){ S.lento = true; render() } }, 10000);
function pronto(){ clearTimeout(relogio); if (S.loading){ S.loading = false; render() } }

if (!CONFIGURADO){
  S.semBanco = true;
  pronto();
} else {
  const app = initializeApp(firebaseConfig);
  S.auth = getAuth(app);
  S.db = getFirestore(app);

  // públicos: configuração e resumo dos resultados
  onSnapshot(doc(S.db, "config", "geral"), s => {
    if (s.exists()){ const d = s.data(); S.cfg = { objetivo:d.objetivo ?? 7.3, pesos:d.pesos || CFG_PADRAO.pesos, limiteNC:d.limiteNC ?? 3 } }
    render();
  }, () => {});
  onSnapshot(doc(S.db, "config", "setores"), s => {
    const l = s.exists() && s.data().lista;
    if (Array.isArray(l) && l.length) S.setores = l;
    render();
  }, () => {});
  onSnapshot(doc(S.db, "config", "checklist"), s => {
    const l = s.exists() && s.data().itens;
    if (Array.isArray(l) && l.length === 25) S.checklist = l;
    render();
  }, () => {});
  onSnapshot(collection(S.db, "resultados"), snap => {
    S.resultados = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    pronto(); render();
  }, err => { console.error(err); pronto() });

  // privados: só depois do login
  onAuthStateChanged(S.auth, async u => {
    S.unsubPriv.forEach(f => f()); S.unsubPriv = [];
    S.user = u || null; S.perfil = null; S.auditorias = []; S.acoes = [];
    if (u){
      try { const p = await getDoc(doc(S.db, "usuarios", u.uid)); if (p.exists()) S.perfil = p.data() } catch (e){ console.error(e) }
      S.unsubPriv.push(onSnapshot(collection(S.db, "auditorias"), snap => {
        S.auditorias = snap.docs.map(d => {
          const o = { id:d.id, ...d.data() };
          const sc = {}; Object.entries(o.scores || {}).forEach(([k,v]) => { if (v != null) sc[+k] = +v });
          const ob = {}; Object.entries(o.obs || {}).forEach(([k,v]) => ob[+k] = v);
          o.scores = sc; o.obs = ob;
          return o;
        });
        render();
      }, e => console.error(e)));
      S.unsubPriv.push(onSnapshot(collection(S.db, "acoes"), snap => {
        S.acoes = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        render();
      }, e => console.error(e)));
    }
    pronto(); render();
  });
}
