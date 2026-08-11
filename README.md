DAOSA — Painel

1. Visão Geral

O projeto consiste no desenvolvimento do Painel DAOSA (Dynamic AI Onboarding Specialist Agent): uma interface Web para que usuários (tenants) possam:


Realizar cadastro e autenticação.
Registrar e configurar suas organizações (org).
Conectar e autenticar serviços de terceiros (Discord, Google Drive, S3, bancos de dados externos, etc.) para uso pelo agente DAOSA.
Salvar essas configurações de forma flexível no banco, seguindo um padrão extensível (EAV) que permita adicionar novos provedores sem alterar a estrutura do banco ou o core da aplicação.
Acompanhar e interagir com o bot configurado através de um chat conectado a um fluxo n8n.


2. Stack Tecnológica


Framework: Next.js (App Router)
Linguagem: TypeScript
Estilização: Tailwind CSS + Shadcn/UI
Banco de Dados / Auth: Supabase (PostgreSQL)
Gerenciamento de Estado: TanStack Query (React Query)


3. Arquitetura do Banco de Dados (Supabase)

Esquema relacional com foco em multi-tenancy e extensibilidade via padrão EAV.

Tabelas principais


org: dados da empresa/cliente.
tenant: usuários autenticados vinculados a uma org. Possui is_master para controle de permissão.
stream_connection: conexões ativas de canal de conversa (Discord, WhatsApp, DAOSA nativo, etc).
drive_auth: configuração de provedores de armazenamento/fonte de dados (Google Drive, S3, banco de dados externo, etc).
eav_config: tabela flexível para salvar chaves/valores de autenticação e configs dinâmicas, vinculada a stream_connection ou drive_auth.
qdrant_metadata: mapeamento de coleções vetoriais por tenant.
message_history: logs de conversas para contexto do agente.


DDL

sqlCREATE TABLE public.org (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  company_name character varying,
  cnpj character varying,
  email character varying,
  phone character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT org_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tenant (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name character varying,
  password character varying,
  email character varying,
  org_id bigint,
  auth_user_id character varying,
  is_master boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tenant_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.org(id)
);

CREATE TABLE public.stream_connection (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  stream_type character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stream_connection_pkey PRIMARY KEY (id),
  CONSTRAINT stream_connection_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);

CREATE TABLE public.drive_auth (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  drive_type character varying,
  tenant_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT drive_auth_pkey PRIMARY KEY (id),
  CONSTRAINT drive_auth_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);

CREATE TABLE public.eav_config (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  key character varying,
  value character varying,
  stream bigint,
  drive bigint,
  CONSTRAINT eav_config_pkey PRIMARY KEY (id),
  CONSTRAINT eav_config_stream_fkey FOREIGN KEY (stream) REFERENCES public.stream_connection(id),
  CONSTRAINT eav_config_drive_fkey FOREIGN KEY (drive) REFERENCES public.drive_auth(id)
);

CREATE TABLE public.qdrant_metadata (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  qdrant_collection_name character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qdrant_metadata_pkey PRIMARY KEY (id),
  CONSTRAINT qdrant_metadata_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);

CREATE TABLE public.message_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tenant_id bigint,
  stream_type character varying,
  external_user_id character varying,
  message character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_history_pkey PRIMARY KEY (id)
);

Padronização das chaves em eav_config

Para manter o EAV organizado e evitar chaves soltas/inconsistentes, todas as key devem seguir o padrão:

<domínio>.<provedor>.<atributo>

Exemplos:

domínioprovedoratributokey finalstreamdiscordbot_tokenstream.discord.bot_tokenstreamdiscordguild_idstream.discord.guild_idstreamdaosachannel_idstream.daosa.channel_iddrivegoogleaccess_tokendrive.google.access_tokendrivegooglerefresh_tokendrive.google.refresh_tokendrives3access_keydrive.s3.access_keydrives3secret_keydrive.s3.secret_keydrives3bucket_namedrive.s3.bucket_namedrivedatabaseconnection_stringdrive.database.connection_string

O domínio (stream ou drive) deve ser coerente com a coluna preenchida (stream ou drive) na linha do eav_config — nunca as duas ao mesmo tempo na mesma linha.

4. Fluxo da Aplicação

4.1 Tela inicial

Landing simples explicando o DAOSA, com CTA para login/registro.

4.2 Registro / Login


/register: cria a org (ou vincula a uma existente) e obrigatoriamente o primeiro tenant, que deve nascer com is_master = true.
/login: autenticação via supabase-js.
Tenants criados posteriormente (convidados por um master) nascem com is_master = false.


4.3 Dashboard


Se o tenant não tiver nenhuma stream_connection ativa, a primeira coisa exibida na sessão é o CTA/formulário "Configurar novo bot" — não faz sentido mostrar listagens vazias antes disso.
Se já existirem conexões, lista as stream_connection ativas do tenant, com botão "Adicionar Nova Conexão".


4.4 Configuração do bot

Formulário em duas etapas, ambas resolvidas via um registry de provedores (não via if/else espalhado pelo código), para permitir adicionar novos provedores no futuro apenas registrando uma nova entrada (Open/Closed Principle).

Etapa 1 — Stream (canal de conversa)


Dropdown com as opções disponíveis (inicialmente: Discord, DAOSA nativo).
Cada opção do dropdown aponta para: (a) o schema de campos do formulário e (b) o fluxo de autenticação/OAuth específico daquele provedor.
Ao escolher, os campos do formulário mudam dinamicamente e o fluxo de autenticação daquele provedor é disparado (ex.: Discord pede bot token/guild id; DAOSA nativo não precisa de autenticação externa).
Ao concluir, cria-se o registro em stream_connection e os valores retornados/inseridos são salvos em eav_config vinculados ao id criado, seguindo a padronização de chaves da seção 3.


Etapa 2 — Drive (fonte de dados)


Dropdown com as opções disponíveis (inicialmente: Google Drive, S3 / cloud pessoal, banco de dados pessoal).
Se Google Drive: dispara o fluxo OAuth2 do Google (app já configurado no Google Cloud, pronto para o consentimento do usuário).
Se S3/cloud pessoal ou banco de dados pessoal: exibe campos de credenciais correspondentes (chaves de acesso, string de conexão, etc).
Ao concluir, cria-se o registro em drive_auth e os valores são salvos em eav_config vinculados ao id criado.
Mesma lógica de registry/schema dinâmico da Etapa 1, para permitir novos provedores de drive sem mexer no core.


4.5 Visão da configuração e chat


Tela de detalhe mostrando como o bot está configurado (stream escolhido + drive escolhido + status).
Independentemente do provedor escolhido, essa tela sempre exibe um widget de chat do DAOSA.
O chat envia as mensagens para um fluxo n8n via webhook. A URL do webhook fica em variável de ambiente (a ser preenchida depois), e o corpo do payload deve ser montado pela aplicação — sugestão de estrutura mínima:


json{
  "tenant_id": "...",
  "org_id": "...",
  "stream_connection_id": "...",
  "message": "...",
  "session_id": "..."
}

5. Segurança

5.1 JWT — princípio do menor privilégio


Usar o JWT emitido pelo Supabase Auth, com custom claims contendo tenant_id, org_id e is_master.
No client, usar apenas a anon key; a service role key nunca deve ser exposta no frontend.
No backend/API routes, validar o JWT e checar is_master antes de qualquer operação sensível.


5.2 RLS (Row Level Security)


Todas as tabelas com dado de tenant devem ter RLS habilitado, restringindo o acesso ao próprio tenant_id/org_id extraído do JWT.
Tenants com is_master = false não podem acessar as telas/rotas de configuração (etapas 4.4 e a tela de detalhe da 4.5, no que envolve editar credenciais). O middleware/rota deve checar is_master e bloquear/redirecionar caso contrário, além da própria política de RLS bloquear no banco.


6. Requisitos de Implementação


Inicializar projeto Next.js com TypeScript e Tailwind.
Configurar variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (uso restrito ao backend), N8N_WEBHOOK_URL, além das credenciais de OAuth necessárias (ex.: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).
Configurar o client do Supabase (lib/supabase.ts), separando client público (anon) de client administrativo (service role, uso server-side apenas).
Criar types/database.types.ts baseado no esquema SQL acima.
Implementar RLS conforme seção 5.2.
Usar Shadcn/UI para formulários de login, cadastro, formulários dinâmicos de conexão e data tables para exibir as conexões.
Implementar o registry de provedores (stream e drive) como módulo isolado, para que novos provedores sejam adicionados por configuração/registro, sem alterar componentes existentes.