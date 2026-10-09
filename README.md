# API Runtime (Sequelize)

The API uses Sequelize with MySQL. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `.env` (see `.env.sample`), then run `npm install` and `npm run dev`. On startup, Sequelize authenticates and creates any missing tables with `sync()`; use migrations for production schema changes. Existing MongoDB data is not copied automatically.

# DAOSA — Dynamic AI Onboarding Specialist Agent

## 1. Objetivo

O DAOSA é uma plataforma para criação e gerenciamento de agentes de IA especializados nas regras de negócio de cada empresa.

Cada agente pode consultar documentos, páginas públicas da internet e sistemas internos para compreender processos, produtos, políticas e procedimentos da organização.

Os agentes podem ser utilizados por diferentes canais de comunicação, como painel web, WhatsApp e Telegram.

## 2. Arquitetura

* **Frontend:** Next.js — painel administrativo para configurar empresas, agentes, fontes de conhecimento e integrações.
* **Backend:** Deno — API REST central responsável por autenticação, gerenciamento, permissões e comunicação com os agentes.
* **Banco de dados:** MySQL — armazenamento de usuários, empresas, agentes, configurações, integrações e histórico de conversas.
* **Engine de IA:** camada responsável por executar os agentes, consultar o conhecimento e integrar modelos de IA por meio de providers configurados na infraestrutura.
* **Knowledge Engine:** camada de recuperação de conhecimento (RAG), responsável por indexar documentos e consultar informações relevantes.
* **Integrações:** adaptadores para canais de comunicação, MCP e fontes externas de conhecimento.

## 3. Entidades principais

* **Organization:** empresa proprietária dos agentes e dos dados.
* **User:** usuário com permissões dentro de uma organização.
* **Agent:** agente com nome, instruções, finalidade, configurações e fontes de conhecimento.
* **Knowledge Source:** documentos, URLs e integrações MCP associados a um agente.
* **Channel:** canal pelo qual um agente recebe e responde mensagens.
* **Conversation:** histórico de interações entre usuários e agentes.

## 4. Fluxo de funcionamento

1. A empresa acessa o painel e cadastra sua organização.
2. Cria um agente e define seu nome, objetivo, instruções e permissões.
3. Associa fontes de conhecimento, como documentos, URLs e servidores MCP autorizados.
4. O sistema processa e indexa os documentos para permitir consultas contextuais por RAG. Integrações MCP disponibilizam ferramentas e dados conforme as permissões concedidas.
5. A empresa conecta o agente aos canais desejados.
6. Quando recebe uma mensagem, a API identifica a organização e o agente, recupera o contexto relevante e executa o agente utilizando o modelo configurado na infraestrutura.
7. A resposta retorna pelo canal de origem, respeitando as permissões e registrando a interação.

## 5. API central

A API possui uma URL fixa e versionada, por exemplo `/api/v1`, e concentra as operações da plataforma.

Principais endpoints:

* `POST /api/v1/auth/login` — autenticação.
* `GET /api/v1/agents` — listar agentes.
* `POST /api/v1/agents` — criar agente.
* `GET /api/v1/agents/:id` — consultar agente.
* `PATCH /api/v1/agents/:id` — atualizar configuração.
* `DELETE /api/v1/agents/:id` — remover agente.
* `POST /api/v1/agents/:id/sources` — adicionar fonte de conhecimento.
* `POST /api/v1/agents/:id/chat` — conversar com um agente.
* `POST /api/v1/webhooks/:channel` — receber mensagens de canais externos.

## 6. Segurança e isolamento

* Cada organização acessa somente seus próprios dados e agentes.
* A API valida autenticação e permissões em todas as operações protegidas.
* Credenciais de providers e integrações ficam em armazenamento seguro na infraestrutura, nunca expostas ao frontend.
* Servidores MCP exigem autorização explícita e permissões limitadas.
* O acesso a ferramentas e ações externas é controlado por agente e organização.
* Documentos e mensagens são tratados como dados não confiáveis, não como instruções privilegiadas do sistema.

## 7. Diretrizes de implementação

* A configuração e o gerenciamento dos agentes pertencem ao DAOSA; os modelos e providers pertencem à infraestrutura.
* O conhecimento é configurado por agente, mas seus recursos e índices devem ser isolados por organização e agente.
* O processamento de documentos e a sincronização de fontes devem ocorrer em tarefas assíncronas.
* Novos canais e providers devem ser adicionados por adaptadores, sem alterar o núcleo da plataforma.
* A primeira versão deve priorizar painel web, API, agentes com RAG documental e histórico de conversas. MCP e canais externos podem ser adicionados progressivamente.

**Princípio central:** o DAOSA gerencia quem são os agentes, o que eles conhecem, quais recursos podem acessar e por onde se comunicam, enquanto a infraestrutura executa a inteligência artificial.

## 8. Visão da arquitetura e banco de dados

### 8.1. Arquitetura do sistema

O DAOSA utiliza uma arquitetura modular, com uma API central responsável por conectar o painel, os agentes, o conhecimento e os canais externos.

```text
              ┌─────────────────────┐
              │   Frontend Next.js  │
              │   Painel do DAOSA   │
              └──────────┬──────────┘
                         │ HTTP / REST
              ┌──────────▼──────────┐
              │     API Deno        │
              │ Autenticação e RBAC │
              │ Gerenciamento       │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
┌─────────▼─────┐ ┌──────▼───────┐ ┌────▼──────────┐
│ MySQL         │ │ Agent Engine │ │ Channel       │
│ Dados e       │ │ Execução e   │ │ Adapters      │
│ configurações │ │ orquestração │ │ WhatsApp etc. │
└───────────────┘ └──────┬───────┘ └───────────────┘
                         │
               ┌─────────┴──────────┐
               │                    │
       ┌───────▼────────┐  ┌────────▼────────┐
       │ Knowledge/RAG  │  │ MCP Connectors  │
       │ Documentos     │  │ Ferramentas e   │
       │ Busca contextual│ │ sistemas externos│
       └────────────────┘  └─────────────────┘
                         │
                ┌────────▼────────┐
                │ Model Providers │
                │ IA configurada │
                │ na infraestrutura│
                └─────────────────┘
```

O **Agent Engine** coordena a execução dos agentes, consultando o RAG ou ferramentas MCP quando necessário. O MySQL armazena os dados transacionais; os documentos e índices vetoriais podem utilizar armazenamento especializado.

### 8.2. Modelo de banco de dados

O banco MySQL utiliza relacionamentos para isolar os dados de cada organização.

**Tabelas principais:**

| Tabela                    | Responsabilidade                                      |
| ------------------------- | ----------------------------------------------------- |
| `organizations`           | Empresas cadastradas na plataforma.                   |
| `users`                   | Usuários e credenciais de acesso.                     |
| `organization_members`    | Vínculo entre usuários, organizações e papéis.        |
| `agents`                  | Identidade, instruções e configurações dos agentes.   |
| `knowledge_sources`       | URLs, documentos e fontes MCP vinculadas aos agentes. |
| `conversations`           | Conversas associadas aos agentes e canais.            |
| `messages`                | Mensagens recebidas e respostas dos agentes.          |
| `channels`                | Canais habilitados e suas configurações.              |
| `agent_channels`          | Associação entre agentes e canais.                    |
| `integration_credentials` | Referências seguras às credenciais de integrações.    |

### 8.3. Relacionamentos

```text
organizations
 ├── organization_members ── users
 ├── agents
 │    ├── knowledge_sources
 │    ├── agent_channels ── channels
 │    └── conversations
 │         └── messages
 └── integration_credentials
```

* Uma organização pode ter vários usuários e agentes.
* Um agente pode possuir várias fontes de conhecimento e canais.
* Uma conversa pertence a um agente e contém várias mensagens.
* As credenciais das integrações são isoladas por organização e acessadas somente pelos componentes autorizados.

### 8.4. Estratégia de armazenamento

* **MySQL:** entidades, configurações, permissões, conversas e metadados.
* **Object Storage:** arquivos originais dos documentos.
* **Banco vetorial:** embeddings e índices para recuperação semântica do RAG.
* **Secret Manager:** credenciais de providers e integrações.
* **Fila de tarefas:** processamento e reindexação assíncrona de documentos.

A infraestrutura de IA, o armazenamento vetorial e a fila podem ser implementados separadamente da API principal, mantendo o núcleo do DAOSA simples e preparado para expansão.
