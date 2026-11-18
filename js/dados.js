/* ============================================================
   Definição do instrumento de auditoria 5S — Raguife
   Alterar o checklist aqui muda o formulário para todos.
   Os setores e os parâmetros também podem ser editados pela
   aba Configurações (gravam em config/ no Firestore).
   ============================================================ */

export const S_INFO = {
  1:{nome:"Seleção",     jp:"Seiri"},
  2:{nome:"Organização", jp:"Seiton"},
  3:{nome:"Limpeza",     jp:"Seiso"},
  4:{nome:"Padronização",jp:"Seiketsu"},
  5:{nome:"Disciplina",  jp:"Shitsuke"}
};

export const LEG = ["Muito ruim","Ruim","Regular","Bom","Ótimo","Excelente"];

export const CHECKLIST_PADRAO = [
 {n:1, s:1, ci:"Materiais ou Equipamentos", d:"Existe equipamentos ou ferramentas que não são utilizados?"},
 {n:2, s:1, ci:"Objetos",          d:"Na área há materiais como (EPI, objetos pessoais, touca, papéis, etc.) que são desnecessários?"},
 {n:3, s:1, ci:"Riscos",           d:"Há itens (cabos elétricos, ar comprimido, ventilação, iluminação ou objetos) que ofereçam risco aos usuários ou demonstrem desorganização?"},
 {n:4, s:1, ci:"Documentos",       d:"Todos os arquivos físicos estão em utilização?"},
 {n:5, s:1, ci:"Móveis",           d:"Os móveis do local estão em 100% de sua utilização? Sua utilização está bem definida?"},
 {n:6, s:2, ci:"Material",         d:"Há materiais e/ou ferramentas fora de seu lugar?"},
 {n:7, s:2, ci:"Equipamentos",     d:"Falta alguma delimitação ou identificação para área de trabalho, passagens, ferramentas, equipamentos, gavetas, armários, etc.?"},
 {n:8, s:2, ci:"Resíduos",         d:"Os coletores de lixo estão devidamente identificados e demarcados?"},
 {n:9, s:2, ci:"Documentos",       d:"Os documentos físicos estão organizados adequadamente?"},
 {n:10,s:2, ci:"Ambiente",         d:"O fluxo está livre, sem bloqueio de passagem, sem dificuldade de movimentação de materiais e para os funcionários da área?"},
 {n:11,s:3, ci:"Equipamentos",     d:"Os equipamentos ou ferramentas estão sujos ou com excesso de sujidades (incrustação)?"},
 {n:12,s:3, ci:"Pisos",            d:"Os pisos são mantidos limpos e livres de resíduos?"},
 {n:13,s:3, ci:"Responsabilidade", d:"Os produtos estão sendo armazenados adequadamente?"},
 {n:14,s:3, ci:"Bancadas e móveis",d:"Bancadas de trabalho e móveis são mantidos limpos?"},
 {n:15,s:3, ci:"Ambiente",         d:"No geral, como se encontra a limpeza do local?"},
 {n:16,s:4, ci:"Ambiente",         d:"A área de trabalho está totalmente marcada, possui padronização (controles visuais e em bom estado)?"},
 {n:17,s:4, ci:"Uniformes",        d:"Os uniformes e EPI's dos colaboradores estão de acordo com padrão definido e em bom estado?"},
 {n:18,s:4, ci:"Documentos",       d:"Os documentos e procedimentos estão padronizados? São mantidos sem rasuras e devidamente preenchidos?"},
 {n:19,s:4, ci:"Responsabilidade", d:"Ferramentas e/ou equipamentos são armazenados ordenadamente em áreas designadas e são devolvidos aos seus locais imediatamente após o uso?"},
 {n:20,s:4, ci:"Aplicação",        d:"Os primeiros 3S estão sendo aplicados?"},
 {n:21,s:5, ci:"Treinamento",      d:"Todos estão adequadamente treinados nos procedimentos padrões?"},
 {n:22,s:5, ci:"Conhecimento",     d:"A equipe conhece o programa BPF e 5S? Entrevistar 1 pessoa sobre: o que é o Programa."},
 {n:23,s:5, ci:"Responsabilidade", d:"Os colaboradores demonstram se importar com o cumprimento dos requisitos do programa 5S?"},
 {n:24,s:5, ci:"Procedimentos",    d:"Foram determinadas ações corretivas para os itens apontados na auditoria?"},
 {n:25,s:5, ci:"EPI",              d:"Os funcionários estão usando os EPI propostos para a área?"}
];

export const AP = "APOIO/PRODUÇÃO";
export const AD = "ADMINISTRATIVO";

export const SETORES_PADRAO = [
 {id:"manutencao",    nome:"Manutenção / PCM",           area:AP},
 {id:"projetos",      nome:"Projetos",                   area:AP},
 {id:"caldeira",      nome:"Caldeira / Utilidades",      area:AP},
 {id:"graxaria",      nome:"Graxaria",                   area:AP},
 {id:"recebimento",   nome:"Recebimento",                area:AP},
 {id:"premix",        nome:"Sala Premix",                area:AP},
 {id:"abastecimento", nome:"Abastecimento / Automação",  area:AP},
 {id:"extrusao",      nome:"Extrusão / Secagem",         area:AP},
 {id:"expedicao",     nome:"Expedição",                  area:AP},
 {id:"expedicao-pet", nome:"Expedição PET",              area:AP},
 {id:"ete",           nome:"ETE",                        area:AP},
 {id:"higienizacao",  nome:"Higienização",               area:AP},
 {id:"ensaque-aqua",  nome:"Ensaque Aqua",               area:AP},
 {id:"ensaque-pet",   nome:"Ensaque / Fábrica PET",      area:AP},
 {id:"estoque-aqua",  nome:"Estoque Aqua",               area:AP},
 {id:"estoque-pet",   nome:"Estoque PET",                area:AP},
 {id:"estoque-mp",    nome:"Estoque de MP",              area:AP},
 {id:"sesmt",         nome:"SESMT",                      area:AD},
 {id:"rh",            nome:"Recursos Humanos",           area:AD},
 {id:"cq",            nome:"Controle de Qualidade",      area:AD},
 {id:"laboratorio",   nome:"Laboratório",                area:AD},
 {id:"refeitorio",    nome:"Refeitório",                 area:AD}
];

export const CFG_PADRAO = {
  objetivo: 7.3,
  pesos: [{area:AP, peso:.8},{area:AD, peso:.2}],
  limiteNC: 3            // nota igual ou menor que isso abre não conformidade
};

export const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const ACAO_STATUS = ["Aberta","Em andamento","Concluída","Cancelada"];

/* --------- cálculo --------- */
// Cada bloco tem 5 itens de 0 a 5 (máx. 25 pontos) → × 0,4 = nota de 0 a 10.
export function blocoTotal(sc, s){
  let t = 0, ok = 0;
  for (let i = (s-1)*5+1; i <= s*5; i++){ if (sc && sc[i] != null){ t += sc[i]; ok++ } }
  return { total: t*0.4, preenchidos: ok };
}
// Resultado do setor = média das cinco notas de senso.
export function resultado(sc){
  let soma = 0;
  for (let s = 1; s <= 5; s++) soma += blocoTotal(sc, s).total;
  return soma/5;
}
export function preenchidos(sc){
  let c = 0;
  for (let i = 1; i <= 25; i++) if (sc && sc[i] != null) c++;
  return c;
}
export function contaNC(sc, limite){
  let c = 0;
  for (let i = 1; i <= 25; i++) if (sc && sc[i] != null && sc[i] <= limite) c++;
  return c;
}
