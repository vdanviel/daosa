# DAOSA — Dynamic AI Onboarding Specialist Agent

## Objetivo

O DAOSA é uma plataforma para criação e gerenciamento de agentes de IA especializados nas regras de negócio de cada empresa.

Cada agente pode consultar documentos, páginas públicas da internet e sistemas internos para compreender processos, produtos, políticas e procedimentos da organização.

Os agentes podem ser utilizados por diferentes canais de comunicação, como painel web, WhatsApp e Telegram.

## Principais funcionalidades

* **Contas e usuários:** cadastro, autenticação, gerenciamento de perfil e recuperação/alteração de credenciais.
* **Gerenciamento de agentes:** criação de agentes com nome, descrição, objetivo, instruções versionadas e configuração de modelo; o schema prevê estados de rascunho, publicação e arquivamento.
* **Base de conhecimento:** cadastro de conteúdo, URLs e arquivos, acompanhamento do processamento e armazenamento de trechos preparados para busca vetorial no Qdrant.
* **Integrações e ferramentas:** configuração de integrações MCP ou API, ferramentas associadas e permissões de acesso por agente.
* **Canais e conversas:** associação de canais aos agentes e registro de conversas e mensagens, incluindo metadados de modelo, tokens, ferramentas utilizadas e latência.
* **Acesso à API:** suporte previsto a chaves com escopos, limite de uso, expiração e revogação.

As tabelas do banco modelam essas capacidades; a API existente já oferece rotas de usuários e agentes, além de consultas de conversas e mensagens. A cobertura dos demais fluxos pode ser implementada progressivamente.

## Arquitetura

* **Frontend:** Next.js — painel administrativo para configurar agentes, fontes de conhecimento e integrações da conta.
* **Backend:** Node.js com Express — API REST central responsável por autenticação e gerenciamento dos recursos.
* **Banco de dados:** MySQL — armazenamento de usuários, agentes, configurações, integrações e histórico de conversas.
* **Engine de IA:** camada responsável por executar os agentes, consultar o conhecimento e integrar modelos de IA por meio de providers configurados na infraestrutura.
* **Knowledge Engine:** camada de recuperação de conhecimento (RAG), responsável por indexar documentos e consultar informações relevantes.
* **Integrações:** adaptadores para canais de comunicação, MCP e fontes externas de conhecimento.

## Entidades principais

* **User:** conta responsável pelo acesso ao painel e proprietária dos recursos, identificada por `user_id`.
* **Agent:** agente pertencente a um usuário, com nome, objetivo, instruções, configuração de modelo e estado.
* **Knowledge Source:** texto, URL ou arquivo associado a um agente; seu conteúdo pode ser dividido em trechos (`knowledge_chunk`).
* **Integration e Tool:** integração MCP ou API e ferramentas disponibilizadas ao agente, sujeitas a permissões.
* **Channel:** canal associado diretamente a um agente.
* **Conversation e Message:** histórico de interações associado ao agente, ao usuário e, opcionalmente, a um canal.

## Fluxo de funcionamento

1. O usuário cria uma conta e acessa o painel.
2. Cria um agente e define seu nome, objetivo, instruções e permissões.
3. Associa fontes de conhecimento, como documentos, URLs e servidores MCP autorizados.
4. O sistema processa e indexa os documentos para permitir consultas contextuais por RAG. Integrações MCP disponibilizam ferramentas e dados conforme as permissões concedidas.
5. O usuário conecta o agente aos canais desejados.
6. Quando recebe uma mensagem, a API identifica o usuário e o agente, recupera o contexto relevante e executa o agente utilizando o modelo configurado na infraestrutura.
7. A resposta retorna pelo canal de origem, respeitando as permissões e registrando a interação.

## Segurança e isolamento

* Cada usuário acessa somente seus próprios dados e agentes, conforme o isolamento por `user_id` previsto no schema.
* A API valida autenticação e permissões em todas as operações protegidas.
* Credenciais de providers e integrações ficam em armazenamento seguro na infraestrutura, nunca expostas ao frontend.
* Servidores MCP exigem autorização explícita e permissões limitadas.
* O acesso a ferramentas e ações externas é controlado por agente e pelas permissões registradas.
* Documentos e mensagens são tratados como dados não confiáveis, não como instruções privilegiadas do sistema.

## Diretrizes de implementação

* A configuração e o gerenciamento dos agentes pertencem ao DAOSA; os modelos e providers pertencem à infraestrutura.
* O conhecimento é configurado por agente e associado ao usuário proprietário; seus recursos e índices devem respeitar esse isolamento.
* O processamento de documentos e a sincronização de fontes devem ocorrer em tarefas assíncronas.
* Novos canais e providers devem ser adicionados por adaptadores, sem alterar o núcleo da plataforma.
* A primeira versão deve priorizar painel web, API, agentes com RAG documental e histórico de conversas. MCP e canais externos podem ser adicionados progressivamente.

**Princípio central:** o DAOSA gerencia quem são os agentes, o que eles conhecem, quais recursos podem acessar e por onde se comunicam, enquanto a infraestrutura executa a inteligência artificial.

## Visão da arquitetura e banco de dados

### Arquitetura do sistema

O DAOSA utiliza uma arquitetura modular, com uma API central responsável por conectar o painel, os agentes, o conhecimento e os canais externos.

```text
              ┌─────────────────────┐
              │   Frontend Next.js  │
              │   Painel do DAOSA   │
              └──────────┬──────────┘
                         │ HTTP / REST
              ┌──────────▼──────────┐
              │ Node.js / Express  │
              │ API REST           │
              │ Autenticação       │
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

### Modelo de banco de dados

O schema atual (`db.sql`) usa nomes de tabelas no singular e relaciona os recursos diretamente ao usuário por meio de `user_id`. Não há tabelas `organization` ou `organization_member`: o isolamento representado no banco é por usuário/conta.

**Tabelas principais:**

| Tabela | Responsabilidade |
| --- | --- |
| `user` | Conta, credenciais, estado e dados básicos do usuário. |
| `agent` | Agente, objetivo, estado e configuração do modelo. |
| `instruction` | Instruções versionadas e ordenadas por prioridade para um agente. |
| `knowledge_source` | Arquivos, URLs ou textos e estado de processamento. |
| `knowledge_chunk` | Trechos de conhecimento e referência opcional ao ponto no Qdrant. |
| `integration` | Integrações MCP/API, endpoint, tipo de autenticação e configuração. |
| `tool` | Ferramentas do agente, schema de entrada e integração opcional. |
| `permission` | Regra de permissão (`allow`/`deny`) para ferramenta, integração, canal ou conhecimento. |
| `channel` | Tipo, configuração e estado do canal associado ao agente. |
| `conversation` | Conversa do agente, usuário e canal opcional, incluindo dados do usuário externo. |
| `message` | Conteúdo e metadados de cada mensagem da conversa. |
| `api_key` | Hash e prefixo da chave, escopos, limites, validade e estado. |

### Relacionamentos

* `user` possui vários `agent`, `instruction`, `knowledge_source`, `knowledge_chunk`, `integration`, `tool`, `permission`, `channel`, `conversation`, `message` e `api_key` por meio de `user_id`.
* `agent` possui várias instruções, fontes de conhecimento, trechos, integrações, ferramentas, permissões, canais, conversas e mensagens.
* `knowledge_source` pode possuir vários `knowledge_chunk`; cada trecho também referencia diretamente seu agente e usuário.
* `integration` pode ser referenciada por várias ferramentas. Ao excluir a integração, `tool.integration_id` fica nulo.
* `channel` pode estar associado a várias conversas. Ao excluir o canal, `conversation.channel_id` fica nulo.
* `conversation` possui várias mensagens; ao excluir conversa, agente ou usuário, as dependências relacionadas são removidas conforme as regras `ON DELETE CASCADE` do schema.

Não existe uma tabela associativa `agent_channels`: `channel` contém `agent_id` diretamente. As credenciais de integração também estão representadas atualmente pelo campo `credentials_encrypted` de `integration`, não por uma tabela separada.

> **Atenção ao schema:** `user` declara o índice único `uq_user_slug`, mas a coluna `slug` não está definida na tabela. Esse ponto precisa ser corrigido no `db.sql` para que a criação do schema funcione.

### Estratégia de armazenamento

* **MySQL:** entidades, configurações, permissões, conversas e metadados descritos neste schema.
* **Qdrant:** armazenamento vetorial referenciado por `knowledge_chunk.qdrant_point_id`.
* **Object Storage, Secret Manager e fila de tarefas:** componentes previstos para armazenar arquivos, proteger segredos e processar documentos de forma assíncrona; não são tabelas deste schema.

A infraestrutura de IA, o armazenamento vetorial e a fila podem ser implementados separadamente da API principal, mantendo o núcleo do DAOSA simples e preparado para expansão.
