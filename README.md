# Programa 5S — Auditoria Interna

Sistema de auditoria 5S da Raguife: aplicação da auditoria em campo, plano de ação
das não conformidades e painel de resultados.

- **Painel aberto** — qualquer pessoa com o link vê os resultados, sem login.
- **Login só para lançar** — auditor entra com e-mail e senha para aplicar a auditoria.
- **Observações e plano de ação** só aparecem para quem está logado.

Site estático (HTML, CSS e JavaScript puros) no GitHub Pages, com Firebase
Authentication e Firestore. Sem build, sem dependências para instalar.

---

## 1. Criar o projeto no Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Adicionar projeto**.
2. **Build ▸ Authentication ▸ Começar ▸ E-mail/senha ▸ Ativar.**
3. **Build ▸ Firestore Database ▸ Criar banco de dados** → modo **produção** →
   região **southamerica-east1 (São Paulo)**.
4. **Configurações do projeto ▸ Seus apps ▸ Web (`</>`)** → registre o app →
   copie o objeto `firebaseConfig`.
5. Cole esse objeto em **`js/firebase-config.js`**.

> As chaves do `firebaseConfig` são públicas por natureza — num site estático
> elas sempre ficam visíveis no navegador. Quem protege os dados são as regras
> do Firestore, não essa chave. Nunca coloque senha ou chave de serviço no repositório.

## 2. Publicar as regras de segurança

Copie o conteúdo de **`firestore.rules`** em
**Firestore ▸ Regras ▸ Publicar**, ou, com a CLI:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

## 3. Cadastrar os auditores

Para cada pessoa que vai lançar auditoria:

1. **Authentication ▸ Users ▸ Add user** — e-mail e uma senha provisória.
2. Copie o **UID** que aparece na lista.
3. **Firestore ▸ Iniciar coleção `usuarios`** → documento com esse UID:

   | campo   | valor                                        |
   |---------|----------------------------------------------|
   | `nome`  | `Tatiana Carla B. Carmona`                   |
   | `papel` | `auditor` — lança auditoria e plano de ação  |
   |         | `gestor` — também altera objetivo, pesos e setores |

Quem entra sem documento em `usuarios` vê tudo, mas não grava nada.
A pessoa troca a própria senha pelo link **Esqueci minha senha** na tela de login.

## 4. Importar as auditorias que já existem

```bash
cd seed
npm install firebase-admin
# Firebase ▸ Contas de serviço ▸ Gerar nova chave privada → salve como seed/chave.json
node importar.mjs auditorias-2026-11-S1.json
```

O arquivo `seed/auditorias-2026-11-S1.json` traz as 22 auditorias da 1ª semana
de novembro, importadas da planilha original.

> **Confira o período antes de importar.** Os registros estão como `2026-11-S1`.
> Se forem de outro mês ou ano, troque o campo `periodo` (e `ano`/`mes`/`semana`)
> no JSON e o nome dos documentos antes de rodar.

## 5. Publicar no GitHub Pages

**Settings ▸ Pages ▸ Source: Deploy from a branch ▸ `main` / `(root)` ▸ Save.**

O site fica em `https://raguiferh.github.io/indicadores5S/`. Em seguida, no Firebase:
**Authentication ▸ Settings ▸ Authorized domains ▸ Add domain** →
`raguiferh.github.io`, senão o login não funciona.

---

## Como os dados ficam organizados

| Coleção      | Quem lê           | Quem grava | Conteúdo |
|--------------|-------------------|------------|----------|
| `resultados` | qualquer pessoa   | auditor    | notas de 1S a 5S, resultado, nº de NC — é o que o painel público mostra |
| `auditorias` | quem está logado  | auditor    | as 25 notas, observações e auditores |
| `acoes`      | quem está logado  | auditor    | plano de ação das não conformidades |
| `config`     | qualquer pessoa   | gestor     | objetivo, pesos e lista de setores |
| `usuarios`   | quem está logado  | ninguém    | quem é auditor (criado à mão no console) |

O identificador de cada auditoria é `periodo__setor`, por exemplo
`2026-11-S1__graxaria`. Auditar o mesmo setor no mesmo período substitui o
registro anterior em vez de duplicar.

## Como o resultado é calculado

- Cada senso tem 5 itens de 0 a 5 → máximo de 25 pontos → **× 0,4** = nota de 0 a 10.
- **Resultado do setor** = média das cinco notas de senso.
- **Resultado ponderado** = média de Apoio/Produção × 0,8 + média do Administrativo × 0,2,
  contando só os setores efetivamente auditados no período.
- Item com nota **até 3** abre uma não conformidade no plano de ação.

Objetivo, pesos e esse limite são editáveis na aba **Configurações** por quem tem papel `gestor`.

## Como mudar o checklist

Os 25 itens ficam em **`js/dados.js`** (`CHECKLIST_PADRAO`). Alterar ali muda o
formulário para todo mundo no próximo carregamento. Para mudar sem mexer no
código, grave um documento `config/checklist` com o campo `itens` contendo os 25
objetos no mesmo formato — ele tem prioridade sobre o arquivo.

## Logo

`assets/logo.svg` é **provisório**. Substitua pelo arquivo oficial da marca
mantendo o mesmo nome. O logotipo "raguife" usa tipografia exclusiva e nunca
deve ser redigitado em outra fonte — use sempre o arquivo original.

## Estrutura

```
index.html               página única
css/app.css              identidade visual Raguife
js/firebase-config.js    PREENCHER com os dados do projeto
js/dados.js              checklist, setores e fórmulas
js/app.js                telas, gráficos e gravação
js/pdf.js                relatório do período e folha da auditoria
vendor/                  jsPDF + autotable (MIT), servidos pelo próprio site
firestore.rules          regras de segurança
seed/                    importação das auditorias existentes
```

Nada é carregado de CDN externo além da fonte Poppins (Google Fonts); o gerador
de PDF está em `vendor/`, então o relatório funciona mesmo se a rede da fábrica
bloquear CDNs.

## Rodar na sua máquina

Módulos ES não funcionam abrindo o arquivo direto; sirva a pasta:

```bash
python3 -m http.server 8080
# depois abra http://localhost:8080
```

Para o login funcionar em `localhost`, ele já vem autorizado no Firebase por padrão.
