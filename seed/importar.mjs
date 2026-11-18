/* ============================================================
   Importa as auditorias de um arquivo JSON para o Firestore.
   Roda uma vez, no computador de quem administra o projeto.

   Pré-requisitos
     1. Node 18 ou mais novo
     2. npm install firebase-admin
     3. Firebase ▸ Configurações do projeto ▸ Contas de serviço ▸
        "Gerar nova chave privada" → salve como chave.json NESTA pasta
        (o .gitignore já impede que esse arquivo vá para o GitHub)

   Uso
     node importar.mjs auditorias-2026-11-S1.json
     node importar.mjs auditorias-2026-11-S1.json --limpar-primeiro

   O script grava DOIS documentos por auditoria:
     auditorias/{id} → notas, observações, auditores  (exige login)
     resultados/{id} → só os números                  (painel público)
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const aqui = dirname(fileURLToPath(import.meta.url));
const arquivo = process.argv[2];
const limpar = process.argv.includes("--limpar-primeiro");
const LIMITE_NC = 3;

if (!arquivo){
  console.error("Uso: node importar.mjs <arquivo.json> [--limpar-primeiro]");
  process.exit(1);
}
const chave = resolve(aqui, "chave.json");
if (!existsSync(chave)){
  console.error("Falta o arquivo chave.json nesta pasta (Firebase ▸ Contas de serviço ▸ Gerar nova chave privada).");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(chave, "utf8"))) });
const db = admin.firestore();

const registros = JSON.parse(readFileSync(resolve(aqui, arquivo), "utf8"));
console.log(`${registros.length} auditoria(s) em ${arquivo}`);

const blocoTotal = (sc, s) => {
  let t = 0;
  for (let i = (s-1)*5+1; i <= s*5; i++) if (sc[i] != null) t += Number(sc[i]);
  return +(t*0.4).toFixed(4);
};

if (limpar){
  for (const col of ["auditorias", "resultados"]){
    const snap = await db.collection(col).get();
    const lote = db.batch();
    snap.docs.forEach(d => lote.delete(d.ref));
    await lote.commit();
    console.log(`  ${col}: ${snap.size} documento(s) apagado(s)`);
  }
}

const lote = db.batch();
let n = 0;
for (const r of registros){
  const { id, _notas, _resultado, _nc, ...dados } = r;
  const scores = {};
  Object.entries(dados.scores || {}).forEach(([k, v]) => { if (v != null) scores[k] = Number(v) });

  const notas = [1,2,3,4,5].map(s => blocoTotal(scores, s));
  const resultado = +(notas.reduce((a,b) => a+b, 0)/5).toFixed(4);
  const nc = Object.values(scores).filter(v => v <= LIMITE_NC).length;
  const base = {
    setorId:dados.setorId, setorNome:dados.setorNome, area:dados.area, periodo:dados.periodo,
    ano:dados.ano, mes:dados.mes, semana:dados.semana, data:dados.data || "",
    atualizadoEm:new Date().toISOString(), origem:dados.origem || "importação"
  };

  lote.set(db.collection("auditorias").doc(id), { ...base, auditores:dados.auditores || "", scores, obs:dados.obs || {} });
  lote.set(db.collection("resultados").doc(id), {
    ...base, resultado, nc, itens:Object.keys(scores).length,
    s1:notas[0], s2:notas[1], s3:notas[2], s4:notas[3], s5:notas[4]
  });
  n++;
  console.log(`  ${dados.setorNome.padEnd(26)} ${notas.map(x => x.toFixed(1)).join("  ")}   →  ${resultado.toFixed(2)}`);
}
await lote.commit();
console.log(`\nPronto: ${n} auditoria(s) gravada(s) em auditorias/ e resultados/.`);
process.exit(0);
