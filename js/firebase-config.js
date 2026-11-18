/* ============================================================
   Configuração do Firebase — PREENCHER

   Cole aqui o bloco que o Firebase mostra em
   Console ▸ Configurações do projeto ▸ Seus apps ▸ App da Web ▸ SDK.

   Estas chaves são públicas por natureza: num site estático elas
   sempre ficam visíveis no navegador. Quem protege os dados são as
   regras do Firestore (arquivo firestore.rules), não esta chave.
   Nunca coloque aqui senha, chave de serviço ou token de admin.
   ============================================================ */

export const firebaseConfig = {
  apiKey:            "COLE_AQUI",
  authDomain:        "COLE_AQUI.firebaseapp.com",
  projectId:         "COLE_AQUI",
  storageBucket:     "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId:             "COLE_AQUI"
};

// Deixe true enquanto a configuração acima não estiver preenchida:
// o sistema abre em modo demonstração, sem gravar nada.
export const CONFIGURADO = !String(firebaseConfig.projectId).includes("COLE_AQUI");
