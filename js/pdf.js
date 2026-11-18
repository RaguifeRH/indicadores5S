/* ============================================================
   Exportação em PDF — Programa 5S Raguife
   Usa jsPDF + autotable, carregados sob demanda.
   ============================================================ */
import { S_INFO, blocoTotal, resultado, LEG, MESES } from "./dados.js";

const VERDE = [2,79,43], OLIVA = [115,150,48], CLARO = [157,205,70];
const CINZA = [102,102,102], CRITICO = [209,73,91], SUAVE = [242,242,242];

// jsPDF e autotable ficam dentro do próprio repositório (pasta vendor/),
// para o PDF funcionar sem depender de CDN externo. Licença MIT — ver vendor/.
const LIBS = [
  "vendor/jspdf.umd.min.js",
  "vendor/jspdf.plugin.autotable.min.js"
];
let carregando = null;
function carregarLib(){
  if (window.jspdf?.jsPDF && window.jspdf.jsPDF.API?.autoTable) return Promise.resolve();
  if (carregando) return carregando;
  carregando = LIBS.reduce((p, src) => p.then(() => new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok;
    s.onerror = () => erro(new Error("Não foi possível carregar a biblioteca de PDF."));
    document.head.appendChild(s);
  })), Promise.resolve());
  return carregando;
}

const n1 = v => v == null || isNaN(v) ? "—" : (Math.round(v*10)/10).toFixed(1).replace(".", ",");
const n2 = v => v == null || isNaN(v) ? "—" : (Math.round(v*100)/100).toFixed(2).replace(".", ",");
const dataBR = s => { const m = String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : "—" };
export function periodoLabel(p){
  const m = String(p||"").match(/^(\d{4})-(\d{2})-S(\d)$/);
  return m ? `${m[3]}ª semana · ${MESES[+m[2]-1]}/${m[1]}` : (p || "—");
}

/* faixa de cabeçalho verde, igual em todos os relatórios */
function cabecalho(doc, titulo, subtitulo){
  const L = doc.internal.pageSize.getWidth();
  doc.setFillColor(...VERDE); doc.rect(0, 0, L, 26, "F");
  doc.setFillColor(...CLARO); doc.rect(14, 7, 12, 12, "F");
  doc.setFillColor(...VERDE);
  [16.6, 20, 23.4].forEach(x => doc.circle(x, 16.2, 1.05, "F"));
  doc.setTextColor(207, 227, 213); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text("PROGRAMA 5S", 31, 11.5);
  doc.setTextColor(255); doc.setFontSize(13);
  doc.text(titulo, 31, 18);
  if (subtitulo){
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(207, 227, 213);
    doc.text(subtitulo, L - 14, 18, { align: "right" });
  }
  doc.setTextColor(40);
}
function rodape(doc){
  const L = doc.internal.pageSize.getWidth(), A = doc.internal.pageSize.getHeight();
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++){
    doc.setPage(i);
    doc.setDrawColor(222); doc.line(14, A-14, L-14, A-14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    doc.text("Raguife · Programa 5S · gerado em " + new Date().toLocaleString("pt-BR"), 14, A-9.5);
    doc.text(`${i}/${total}`, L-14, A-9.5, { align: "right" });
  }
}
function baixar(doc, nome){ doc.save(nome) }

/* ------------------------------------------------------------
   1) Relatório do período — o consolidado da indústria
   ------------------------------------------------------------ */
export async function pdfPeriodo({ periodo, auds, cfg, ponderado, medias, acoes }){
  await carregarLib();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = doc.internal.pageSize.getWidth();
  const obj = cfg.objetivo;

  cabecalho(doc, "Resultado da auditoria", periodoLabel(periodo));

  /* três quadros de destaque */
  const quadros = [
    ["RESULTADO PONDERADO", n2(ponderado), ponderado == null ? "" : (ponderado >= obj ? "acima do objetivo " + n1(obj) : "abaixo do objetivo " + n1(obj))],
    ["SETORES AUDITADOS", String(auds.length), periodoLabel(periodo)],
    ["ABAIXO DO OBJETIVO", String(auds.filter(a => a.res < obj).length), "de " + auds.length + " setores"]
  ];
  const lq = (L - 28 - 8) / 3;
  quadros.forEach(([k, v, m], i) => {
    const x = 14 + i*(lq+4);
    if (i === 0){ doc.setFillColor(...VERDE); doc.rect(x, 34, lq, 24, "F") }
    else { doc.setDrawColor(222); doc.setFillColor(255); doc.rect(x, 34, lq, 24, "FD") }
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    doc.setTextColor(...(i === 0 ? [191,217,200] : CINZA));
    doc.text(k, x+4, 40);
    doc.setFontSize(18); doc.setTextColor(...(i === 0 ? [255,255,255] : VERDE));
    doc.text(v, x+4, 49);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.setTextColor(...(i === 0 ? [207,227,213] : CINZA));
    doc.text(m, x+4, 54.5);
  });

  /* média de cada senso */
  doc.setTextColor(...VERDE); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("MÉDIA DE CADA SENSO", 14, 68);
  const lb = (L - 28 - 16) / 5;
  for (let s = 1; s <= 5; s++){
    const x = 14 + (s-1)*(lb+4), v = medias[s];
    doc.setFillColor(...SUAVE); doc.rect(x, 72, lb, 20, "F");
    doc.setFillColor(...OLIVA); doc.rect(x, 72, lb * Math.min(v ?? 0, 10)/10, 20, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(n2(v), x+3, 81);
    doc.setFontSize(6.5); doc.setTextColor(40);
    doc.text(`${s}S · ${S_INFO[s].nome}`, x, 96);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...CINZA); doc.setFontSize(6);
    doc.text(S_INFO[s].jp.toUpperCase(), x, 99.5);
  }

  /* tabela por setor */
  const linhas = auds
    .slice()
    .sort((x, y) => y.res - x.res)
    .map(a => [
      a.setorNome, a.area === "ADMINISTRATIVO" ? "Adm." : "Apoio/Prod.",
      ...a.notas.map(n1),
      n2(a.res), String(a.nc ?? 0),
      a.res >= 9 ? "Excelente" : (a.res >= obj ? "No objetivo" : "Abaixo do objetivo")
    ]);

  doc.autoTable({
    startY: 106,
    head: [["Setor","Área","1S","2S","3S","4S","5S","Resultado","NC","Situação"]],
    body: linhas,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, lineColor: [228,228,228], textColor: 40 },
    headStyles: { fillColor: VERDE, textColor: 255, fontSize: 7, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250,251,248] },
    columnStyles: {
      0:{ cellWidth: 40, fontStyle:"bold" }, 1:{ cellWidth: 20 },
      2:{ halign:"right" },3:{ halign:"right" },4:{ halign:"right" },5:{ halign:"right" },6:{ halign:"right" },
      7:{ halign:"right", fontStyle:"bold" }, 8:{ halign:"right", cellWidth: 10 }, 9:{ cellWidth: 30 }
    },
    didParseCell: d => {
      if (d.section === "body" && d.column.index === 9 && d.cell.raw === "Abaixo do objetivo"){
        d.cell.styles.textColor = CRITICO; d.cell.styles.fontStyle = "bold";
      }
      if (d.section === "body" && d.column.index === 8 && +d.cell.raw > 0) d.cell.styles.textColor = CRITICO;
    },
    margin: { left: 14, right: 14, bottom: 20 }
  });

  /* média por área */
  let y = doc.lastAutoTable.finalY + 8;
  const porArea = cfg.pesos.map(w => {
    const arr = auds.filter(a => a.area === w.area);
    const m = arr.length ? arr.reduce((t,a) => t + a.res, 0)/arr.length : null;
    return [w.area, String(arr.length), n1(w.peso), n2(m), n2(m == null ? null : m*w.peso)];
  });
  doc.autoTable({
    startY: y,
    head: [["Área","Setores","Peso","Média","Contribuição"]],
    body: [...porArea, ["RESULTADO PONDERADO","","","", n2(ponderado)]],
    theme: "grid",
    styles: { font:"helvetica", fontSize: 8, cellPadding: 2, lineColor:[228,228,228] },
    headStyles: { fillColor: OLIVA, textColor: 255, fontSize: 7, fontStyle: "bold" },
    columnStyles: { 1:{halign:"right"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right",fontStyle:"bold"} },
    didParseCell: d => { if (d.section === "body" && d.row.index === porArea.length) d.cell.styles.fillColor = [238,244,228] },
    margin: { left: 14, right: 14, bottom: 20 }
  });

  /* plano de ação em aberto */
  const abertas = (acoes || []).filter(x => x.status !== "Concluída" && x.status !== "Cancelada");
  if (abertas.length){
    doc.addPage();
    cabecalho(doc, "Plano de ação em aberto", `${abertas.length} ação(ões)`);
    const hoje = new Date().toISOString().slice(0,10);
    doc.autoTable({
      startY: 34,
      head: [["Setor","Item","O que será feito","Responsável","Prazo","Status"]],
      body: abertas
        .slice()
        .sort((a,b) => String(a.prazo||"9").localeCompare(String(b.prazo||"9")))
        .map(x => [
          x.setorNome, `${x.item}`, x.oque || "—", x.quem || "—", dataBR(x.prazo),
          (x.prazo && x.prazo < hoje) ? "Atrasada" : x.status
        ]),
      theme: "grid",
      styles: { font:"helvetica", fontSize: 8, cellPadding: 2, lineColor:[228,228,228], valign:"top" },
      headStyles: { fillColor: VERDE, textColor: 255, fontSize: 7, fontStyle:"bold" },
      columnStyles: { 0:{cellWidth:32,fontStyle:"bold"},1:{cellWidth:12,halign:"right"},3:{cellWidth:30},4:{cellWidth:20},5:{cellWidth:24} },
      didParseCell: d => { if (d.section === "body" && d.column.index === 5 && d.cell.raw === "Atrasada"){ d.cell.styles.textColor = CRITICO; d.cell.styles.fontStyle = "bold" } },
      margin: { left: 14, right: 14, bottom: 20 }
    });
  }

  rodape(doc);
  baixar(doc, `5S_${periodo}_resultado.pdf`);
}

/* ------------------------------------------------------------
   2) Folha da auditoria de um setor — para assinar e arquivar
   ------------------------------------------------------------ */
export async function pdfAuditoria(aud, checklist, cfg){
  await carregarLib();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = doc.internal.pageSize.getWidth();
  const r = resultado(aud.scores);

  cabecalho(doc, aud.setorNome, periodoLabel(aud.periodo));

  doc.setDrawColor(222); doc.setFillColor(255); doc.rect(14, 32, L-28, 18, "FD");
  const campos = [
    ["DATA", dataBR(aud.data)],
    ["ÁREA", aud.area],
    ["RESULTADO", n2(r) + " / 10"],
    ["OBJETIVO", n1(cfg.objetivo)]
  ];
  campos.forEach(([k, v], i) => {
    const x = 18 + i*((L-36)/4);
    doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.setTextColor(...CINZA); doc.text(k, x, 38);
    doc.setFontSize(10); doc.setTextColor(...VERDE); doc.text(String(v), x, 44.5);
  });
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(...CINZA);
  doc.text("Auditores: " + (aud.auditores || "—"), 14, 55, { maxWidth: L-28 });

  /* notas por senso */
  let y = 60;
  doc.autoTable({
    startY: y,
    head: [["1S Seleção","2S Organização","3S Limpeza","4S Padronização","5S Disciplina"]],
    body: [[1,2,3,4,5].map(s => n1(blocoTotal(aud.scores, s).total))],
    theme: "grid",
    styles: { font:"helvetica", fontSize: 11, fontStyle:"bold", halign:"center", cellPadding: 3, textColor: VERDE, lineColor:[228,228,228] },
    headStyles: { fillColor: OLIVA, textColor: 255, fontSize: 7, halign:"center" },
    margin: { left: 14, right: 14, bottom: 20 }
  });

  /* os 25 itens */
  const corpo = [];
  for (let s = 1; s <= 5; s++){
    corpo.push([{ content: `${s}S · ${S_INFO[s].nome.toUpperCase()} (${S_INFO[s].jp})  —  nota ${n1(blocoTotal(aud.scores,s).total)}`,
                  colSpan: 4, styles: { fillColor: [238,244,228], textColor: VERDE, fontStyle: "bold", fontSize: 8 } }]);
    checklist.filter(c => c.s === s).forEach(c => {
      const v = aud.scores[c.n];
      corpo.push([
        String(c.n),
        c.d,
        v == null ? "—" : `${v} · ${LEG[v]}`,
        (aud.obs && aud.obs[c.n]) || ""
      ]);
    });
  }
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 5,
    head: [["#","Item verificado","Nota","Observação"]],
    body: corpo,
    theme: "grid",
    styles: { font:"helvetica", fontSize: 7.5, cellPadding: 2, lineColor:[228,228,228], valign:"top", textColor: 40 },
    headStyles: { fillColor: VERDE, textColor: 255, fontSize: 7, fontStyle:"bold" },
    columnStyles: { 0:{cellWidth:8,halign:"right"}, 1:{cellWidth:72}, 2:{cellWidth:24}, 3:{cellWidth:"auto"} },
    didParseCell: d => {
      if (d.section === "body" && d.column.index === 2 && typeof d.cell.raw === "string"){
        const nota = parseInt(d.cell.raw, 10);
        if (!isNaN(nota) && nota <= cfg.limiteNC){ d.cell.styles.textColor = CRITICO; d.cell.styles.fontStyle = "bold" }
      }
    },
    margin: { left: 14, right: 14, bottom: 20 }
  });

  /* campo de assinatura */
  let fy = doc.lastAutoTable.finalY + 14;
  if (fy > doc.internal.pageSize.getHeight() - 40){ doc.addPage(); fy = 30 }
  doc.setDrawColor(150);
  doc.line(14, fy, 90, fy); doc.line(L-90, fy, L-14, fy);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(...CINZA);
  doc.text("Auditor", 14, fy+4.5);
  doc.text("Responsável pelo setor", L-90, fy+4.5);

  rodape(doc);
  baixar(doc, `5S_${aud.periodo}_${aud.setorId}.pdf`);
}
