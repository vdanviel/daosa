# Testes do Backend

Suíte de testes do `backend/`, dividida em três categorias com runners diferentes:

| Categoria | Runner | Extensão | O que cobre |
|---|---|---|---|
| `unit` | Vitest | `*.test.js` | Funções puras e configurações, sem HTTP |
| `feature` | Vitest + Supertest | `*.test.js` | Rotas da API subindo o `app` Express em memória |
| `e2e` | Playwright | `*.spec.js` | Fluxos completos no navegador (frontend + backend reais) |

---

## 1. Estrutura e propósito de cada pasta

```
backend/test/
├── run.sh        # Orquestrador CLI (entry point recomendado)
├── setup/        # Sobe a aplicação para os testes subirem nela
├── helper/       # Utilitários compartilhados entre as três categorias
├── unit/         # Testes de lógica isolada
├── feature/      # Testes de rota/endpoint da API
└── e2e/          # Testes de fluxo completo no navegador
    └── .output/  # Artefatos gerados pelo Playwright (descritos abaixo)
```

- **`unit/`** — testa código **isolado**: funções, utilitários e configurações, importando direto de `src/` sem subir servidor, sem HTTP e sem depender de estado da aplicação. É a categoria mais rápida e estável; quando algo é uma regra de negócio pura (validação de CPF, geração de código, formatação...), o lugar é aqui.

- **`feature/`** — testa **um pedaço da aplicação de ponta a ponta**: sobe o `app` Express (via `setup/`) e chama rotas reais com Supertest, validando status, corpo, middlewares e persistência no banco. Cobre o comportamento da API sem passar por navegador. É onde ficam os testes de endpoints (`/v1/...`).

- **`e2e/`** — testa o **fluxo do usuário real**: Playwright abre o navegador, acessa o frontend e valida o comportamento completo (frontend + backend + banco juntos), como login, navegação e mensagens de erro na tela. É a categoria mais lenta e depende de serviços e portas específicas.

- **`setup/`** — prepara a aplicação para os testes. Hoje contém o `testIndex.js`, que monta o app Express e inicializa dependências (banco, papéis, canal, Qdrant, workers) exportando o `app` para os testes de `feature/` usarem.

- **`helper/`** — funções reutilizáveis usadas pelas três categorias (criar dados de teste, autenticar, etc.). Não contém testes em si.

- **`e2e/.output/`** — **gerado pelo Playwright**, não é código:
  - `report/` — relatório HTML da última execução (`npx playwright show-report test/e2e/.output/report`)
  - `result/` — screenshots/traces das falhas (o trace é gravado no retry)

  Ambos já estão no `.gitignore` e podem ser apagados a qualquer momento.

> Os arquivos de teste listados na seção 5 mudam conforme a suíte evolui; o que importa é o propósito de cada pasta acima.

Arquivos de configuração relacionados (ficam na raiz do `backend/`):

- `vitest.config.js` — define `TEST_MODE=1` e **exclui** `test/e2e/**` do Vitest.
- `playwright.config.js` — define `TEST_MODE=1`, sobe backend/frontend e aponta relatórios para `test/e2e/.output/`.

---

## 2. Pré-requisitos

1. **Serviços de infraestrutura de pé** (mesmos do `compose.local.yml` / `compose.yml`):

   | Serviço | Porta usada no teste | Uso nos testes |
   |---|---|---|
   | MySQL | `localhost:3301` | schema `daosa-test` |
   | Qdrant | `localhost:6333` | collection `daosa-test` |
   | Redis | `localhost:6380` | filas BullMQ (workers de e-mail) |

   ```bash
   docker compose -f compose.local.yml up -d
   ```

   > **Provedor de IA:** não é pré-requisito fixo. Só é necessário nos testes que disparam LLM/embeddings (chat, RAG), e o provedor é **o que estiver configurado no `.env.test`** (`LLM_PROVIDER` / `LLM_BASE_URL` / `EMBEDDING_LLM_*`) — pode ser local (ex.: Ollama) ou um serviço externo (OpenAI, OpenRouter, Bedrock...). Os testes atuais (unit, register e login) não dependem dele.

2. **`.env.test` criado** a partir do sample (é ignorado pelo git):

   ```bash
   cp backend/.env.test.sample backend/.env.test
   ```

   Ajuste `JWT_SECRET` e `SESSION_SECRET_PASS` para chaves aleatórias de **pelo menos 32 bytes** (`Env.validate()` derruba a aplicação caso contrário).

3. **Dependências**: `npm install` em `backend/` e no `frontend/` (o e2e precisa do Next).

4. **Navegador do Playwright** (só para e2e):

   ```bash
   cd backend && npx playwright install chromium
   ```

---

## 3. Como rodar

### Via `run.sh` (recomendado)

```bash
# a partir de qualquer diretório
backend/test/run.sh unit                 # todos os unit
backend/test/run.sh feature              # todos os feature
backend/test/run.sh e2e                  # todos os e2e
backend/test/run.sh all                  # unit → feature → e2e, em sequência

# um arquivo (o sufixo .test.js é completado automaticamente)
backend/test/run.sh feature agent.feature
backend/test/run.sh e2e login.spec.js

# um teste específico — texto LITERAL (describe + it juntos, separados por espaço)
backend/test/run.sh feature agent.feature -t 'create agent'
backend/test/run.sh unit Util -t 'aceita um CPF válido'

# filtro por regex
backend/test/run.sh unit Util -r 'isValidDocument.*CPF v[aá]lido'

# listar os nomes dos testes (para descobrir o texto do filtro)
backend/test/run.sh feature agent.feature -v
```

Flags: `-t/--test <texto>` (literal), `-r/--regex <regex>`, `-v/--verbose`, `-h/--help`.

> Um 3º argumento posicional sem flag é tratado como regex (compatibilidade com o formato antigo).

### Via npm

```bash
cd backend
npm test           # vitest run → unit + feature (e2e fica de fora por config)
npm run test:browser   # vitest em modo watch
```

O `run.sh` sempre força execução em série (`--maxWorkers=1 --no-file-parallelism`; no e2e, `workers: 1`) porque os testes **compartilham o mesmo banco `daosa-test`**.

### Relatório do e2e

```bash
npx playwright show-report test/e2e/.output/report
```

## 4. Suporte (`setup/` e `helper/`)

### `setup/testIndex.js`

Monta o app Express usado pelos testes de feature e o exporta (`app`), **sem chamar `listen`** — o Supertest sobe um servidor efêmero por requisição. No import ele já executa `start()`:

1. `connectDatabase()` → autentica e faz `sequelize.sync()` (cria/atualiza tabelas de `daosa-test`)
2. `initializeDefaultRole()` → papéis padrão
3. `initializeChannels()` → canal `own`
4. `ensureQdrantCollections()` → coleções do Qdrant
5. `initFixedWorkers()` → workers BullMQ (exige Redis)

Middlewares registrados: `express.json`, `express-session`, `cors` (origem = `SPA_APPLICATION_URL`), rotas em `/v1` e `errorHandler`.

### `helper/http.js`

Centraliza o **trabalho intermediário entre requisições**: tudo que um teste precisa preparar *antes* de chamar uma rota (ou *interpretar* depois), mas que não é teste em si. Em vez de cada teste recriar usuário, hash de senha e token na mão, ele chama essas funções e segue para a asserção. Serve para as três categorias (unit, feature e e2e).

Hoje ele expõe:

| O que exporta | O que faz |
|---|---|
| `testUser()` | `findOrCreate` do usuário `test-user@daosa.test` com senha **hash bcrypt**; corrige linhas antigas salvas em texto puro (senão o login cai em 401) |
| `validJWTUser()` | Assina um JWT `{ data: { sub: user.id }, scope: [] }` com `JWT_SECRET`, validade 168h |

O padrão é: **dados → token → requisição → asserção**. Se um teste precisar de outro intermediário (outro tipo de usuário, escopo de token, header customizado), a função nova entra aqui para ficar reutilizável.

---

## 5. Guia para escrever novos testes

### Convenções

- Nome do arquivo: `nome.test.js` em `unit/` ou `feature/`; `nome.spec.js` em `e2e/`.
- Nome completo de um teste = `describe` + ` ` + `it` → é o que `-t`/`-r` usam para filtrar.
- Importe tudo de `../../src/...` (relativo ao arquivo de teste) e o app de `../setup/testIndex.js`.

### Unit

Para funções/utilitários puros — sem app, sem HTTP:

```js
import { describe, it, expect } from 'vitest';
import Utils from '../../src/util/Util.js';

describe('Utils.meuMetodo', () => {
  it('retorna o esperado', () => {
    expect(Utils.meuMetodo('entrada')).toBe('saida');
  });
});
```

Para checar configuração (como `testDatabase.test.js`), basta importar o módulo de conexão e inspecionar `sequelize.config`.

### Feature (Supertest)

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../setup/testIndex.js';
import { testUser, validJWTUser } from '../helper/http.js';

describe('/v1/rota', () => {
  it('descrição do comportamento', async () => {
    const user = await testUser();          // pré-condições no banco
    const jwt = await validJWTUser();       // token do mesmo usuário

    const response = await request(app)
      .post('/v1/rota')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ campo: 'valor' });

    expect(response.status).toBe(200);
    expect(response.body.user_id).toBe(user.id);
  });
});
```

Boas práticas:

- Crie os dados **antes** de chamar a rota (o `testIndex.js` já garante canal `own` e papéis).
- Use nomes únicos para registros criados a cada execução (`Date.now()`), já que o banco é compartilhado.
- Não dependa de ordem entre arquivos: cada um roda de forma independente.

### E2E (Playwright)

```js
import { test, expect } from '@playwright/test';
import { testUser } from '../helper/http.js';

test.describe('Fluxo X', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rota');
  });

  it('descrição do fluxo', async ({ page }) => {
    const user = await testUser();

    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Senha').fill("password");

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/endpoint') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Entrar' }).click(),
    ]);

    expect(response.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/rota/);
  });
});
```

Dicas:

- Espere a resposta da API junto com o clique (`Promise.all`) em vez de `waitForTimeout`.
- Selecione por role/label acessível (`getByRole`, `getByLabel`) — mais estáveis que seletores CSS.
- Erros e prints do Next/back-end aparecem no console com prefixo `[WebServer]`.
- Rode um arquivo só enquanto desenvolve: `backend/test/run.sh e2e login.spec.js -v`.
