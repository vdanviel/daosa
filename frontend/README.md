# DAOSA — Dynamic AI Onboarding Specialist Agent

## 1. Visão geral

O **DAOSA** é uma plataforma para criação e gerenciamento de agentes de IA especializados nas regras de negócio de empresas.

Cada empresa pode criar agentes, fornecer informações sobre seu negócio e disponibilizá-los em diferentes canais de comunicação.

O objetivo é permitir que qualquer empresa crie agentes especializados sem precisar implementar sua própria infraestrutura de IA.

## 2. Tecnologias

* **Backend:** Node.js
* **Banco de dados:** MySQL + Qdrant
* **Frontend:** Next.js
* **IA:** LLMs gerenciados pela infraestrutura do DAOSA
* **Conhecimento:** RAG gerenciado automaticamente pela plataforma
* **Integrações:** MCP e APIs externas

## 3. Harness

O Harness é o painel administrativo onde a empresa configura seus agentes.

Cada agente possui:

* **Identidade:** nome, descrição e objetivo.
* **Instruções:** comportamento e regras que deve seguir.
* **Conhecimento:** documentos, URLs e outras fontes de informação.
* **Integrações:** conexão com sistemas externos via MCP ou APIs.
* **Ferramentas:** operações que o agente pode executar.
* **Permissões:** limites de acesso aos dados e às ferramentas.
* **Canais:** interfaces pelas quais o agente estará disponível.

A empresa não precisa configurar embeddings, chunking, vector databases ou pipelines de RAG. Tudo isso é gerenciado internamente pelo DAOSA.

## 4. Fluxo de criação

1. A empresa cria um agente no Harness.
2. Define sua identidade, objetivo e instruções.
3. Adiciona documentos, URLs e outras fontes de conhecimento.
4. Conecta sistemas externos, quando necessário.
5. Define permissões e canais de comunicação.
6. Publica o agente.

Após a publicação, o DAOSA processa as fontes de conhecimento automaticamente e disponibiliza o agente para utilização.

## 5. Conhecimento e integrações

O DAOSA utiliza duas abordagens complementares.

**Conhecimento documental**

A empresa adiciona arquivos e URLs. O DAOSA extrai e processa o conteúdo, indexa as informações e recupera os trechos relevantes durante as conversas por meio de RAG.

**Integrações via MCP**

O agente pode consultar sistemas externos e executar operações autorizadas. Isso permite acessar informações atualizadas, como dados de clientes, pedidos ou registros internos.

O DAOSA gerencia a execução dessas integrações, respeitando as permissões configuradas.

## 6. Arquitetura

```text
             Harness — Next.js
                     |
                     v
             DAOSA API — Spring Boot
                     |
          +----------+-----------+
          |          |           |
          v          v           v
       MySQL    Agent Runtime   Canais
                     |
             +-------+-------+
             |               |
             v               v
        Knowledge         MCP / Tools
          Engine
             |
             v
          RAG interno
             |
             v
       AI Infrastructure
             |
             v
        LLM Provider
```

O **Agent Runtime** coordena a execução dos agentes. O Knowledge Engine gerencia o processamento e a recuperação de conhecimento. A infraestrutura de IA gerencia modelos, providers, credenciais, roteamento e limites de uso.

O RAG e a escolha do modelo são detalhes internos da plataforma, não configurações obrigatórias do cliente.

## 7. Canais de comunicação

Os agentes podem ser disponibilizados por diferentes canais, como:

* Web Chat;
* WhatsApp;
* Telegram;
* Discord;
* API pública.

Todos os canais utilizam o mesmo Agent Runtime, evitando duplicação da lógica e das configurações dos agentes.

## 8. API principal

A API centraliza o gerenciamento e a execução da plataforma.

```text
POST   /agents
GET    /agents
GET    /agents/{id}
PUT    /agents/{id}
DELETE /agents/{id}

POST   /agents/{id}/knowledge
POST   /agents/{id}/integrations
POST   /agents/{id}/publish

POST   /agents/{id}/chat
GET    /conversations
GET    /conversations/{id}

POST   /channels
GET    /channels
```

Os endpoints são uma proposta inicial e podem evoluir conforme os requisitos do projeto.

## 9. Modelo de dados

```text
Company
 ├── Users
 ├── Agents
 │    ├── Instructions
 │    ├── Knowledge Sources
 │    ├── Integrations
 │    ├── Tools
 │    ├── Channels
 │    └── Conversations
 └── API Keys
```

Cada empresa possui seus próprios agentes e dados, com isolamento de acesso entre organizações.

## 10. Princípio arquitetural

O DAOSA separa três responsabilidades:

* **Configuração:** a empresa define o agente e fornece o conhecimento.
* **Execução:** o DAOSA processa informações, recupera contexto e coordena ferramentas.
* **Infraestrutura:** o DAOSA gerencia modelos de IA, providers e recursos técnicos.

**O cliente ensina o agente sobre o negócio. O DAOSA cuida da complexidade técnica para fazê-lo funcionar.**
