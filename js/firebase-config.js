/* ============================================================
   Configuração do Firebase — projeto indicadores-5s

   Estas chaves são públicas por natureza: num site estático elas
   sempre ficam visíveis no navegador. Quem protege os dados são as
   regras do Firestore (arquivo firestore.rules), não esta chave.
   Nunca coloque aqui senha, chave de serviço ou token de admin.
   ============================================================ */

export const firebaseConfig = {
  apiKey:            "AIzaSyCm2EB-tLh_hWfXA6P3Q89kh7pSmzYQKu4",
  authDomain:        "indicadores-5s.firebaseapp.com",
  projectId:         "indicadores-5s",
  storageBucket:     "indicadores-5s.firebasestorage.app",
  messagingSenderId: "972190351264",
  appId:             "1:972190351264:web:03f41e0fc4ffa348072ec5"
};

export const CONFIGURADO = !String(firebaseConfig.projectId).includes("COLE_AQUI");
