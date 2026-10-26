-- =============================================================
-- DAOSA — Dynamic AI Onboarding Specialist Agent
-- Schema completo (MySQL 8.0+)
-- =============================================================
-- Convenções:
--  - Tabelas de negócio usam user_id (isolamento por usuário/conta)
--  - Timestamps em UTC
--  - Soft delete via deleted_at nas tabelas principais
--  - Nomes das tabelas no singular
-- =============================================================

CREATE DATABASE IF NOT EXISTS daosa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE daosa;

CREATE TABLE user (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(255) NULL,
    email         VARCHAR(255) NULL,
    document      VARCHAR(255) NULL,
    password_hash VARCHAR(255) NULL,           
    status        ENUM('active','suspended','invited','disabled') NULL DEFAULT 'active',
    last_login_at DATETIME     NULL,
    created_at    DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_email (email),
    UNIQUE KEY uq_user_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE agent (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NULL,
    name        VARCHAR(255) NULL,
    description TEXT         NULL,
    objective   VARCHAR(30)         NULL,                 
    status      ENUM('draft', 'active', 'archived') NULL DEFAULT 'draft',
    model_config JSON        NULL,                 
    created_at  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME     NULL,
    PRIMARY KEY (id),
    KEY idx_agent_user (user_id),
    CONSTRAINT fk_agent_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE instruction (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id    BIGINT UNSIGNED NULL,
    user_id     BIGINT UNSIGNED NULL,                 
    title       VARCHAR(255) NULL,
    content     TEXT     NULL,                 
    priority    INT      NULL DEFAULT 0,       
    version     INT      NULL DEFAULT 1,
    is_active   TINYINT(1) NULL DEFAULT 1,
    created_at  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_instruction_agent (agent_id),
    KEY idx_instruction_user (user_id),
    CONSTRAINT fk_instruction_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_instruction_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE knowledge_source (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id      BIGINT UNSIGNED NULL,
    user_id       BIGINT UNSIGNED NULL,
    type          ENUM('file','url','text') NULL,
    title         VARCHAR(500) NULL,
    file_name     VARCHAR(500) NULL,
    file_path     VARCHAR(1000) NULL,              
    file_mime     VARCHAR(100) NULL,
    file_size     BIGINT       NULL,
    url           VARCHAR(2000) NULL,
    status        ENUM('pending','processing','processed','failed') NULL DEFAULT 'pending',
    error_message TEXT         NULL,
    processed_at  DATETIME     NULL,
    created_at    DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_knowledge_agent (agent_id),
    KEY idx_knowledge_user (user_id),
    KEY idx_knowledge_status (status),
    CONSTRAINT fk_knowledge_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_knowledge_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE knowledge_chunk (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    knowledge_source_id BIGINT UNSIGNED NULL,
    agent_id            BIGINT UNSIGNED NULL,
    user_id             BIGINT UNSIGNED NULL,
    chunk_index         INT         NULL,          
    token_count         INT         NULL,
    qdrant_point_id     CHAR(36)    NULL,             
    created_at          DATETIME    NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_chunk_qdrant (qdrant_point_id),
    KEY idx_chunk_source (knowledge_source_id),
    KEY idx_chunk_agent (agent_id),
    CONSTRAINT fk_chunk_source FOREIGN KEY (knowledge_source_id) REFERENCES knowledge_source (id) ON DELETE CASCADE,
    CONSTRAINT fk_chunk_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_chunk_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE integration (
    id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id              BIGINT UNSIGNED NOT NULL,
    provider             VARCHAR(50)   NOT NULL,   -- 'google_drive' | 'whatsapp' | 'telegram' | 'discord' | 'openai' | ...
    label                VARCHAR(150)  NULL,       -- exibição: "Conta Google — victor@empresa.com"
    auth_type            ENUM('none','api_key','oauth2','basic') NOT NULL DEFAULT 'api_key',
    credentials_encrypted TEXT          NULL,       -- JSON SECRETO inteiro, AES-256-GCM
    config               JSON          NULL,       -- metadados NÃO-secretos, formato livre por provedor
    secret_expires_at    DATETIME      NULL,       -- validade do access_token
    status               ENUM('active','revoked','error') NOT NULL DEFAULT 'active',
    last_used_at         DATETIME      NULL,
    created_at           DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_connection_user_provider (user_id, provider),
    KEY idx_connection_status (status),
    CONSTRAINT fk_connection_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tool (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id        BIGINT UNSIGNED NULL,
    user_id         BIGINT UNSIGNED NULL,
    integration_id  BIGINT UNSIGNED NULL,                 
    name            VARCHAR(255) NULL,
    description     TEXT NULL,                     
    `schema`        JSON NULL,                 
    is_enabled      TINYINT(1) NULL DEFAULT 1,
    created_at      DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tool_agent (agent_id),
    CONSTRAINT fk_tool_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_tool_integration FOREIGN KEY (integration_id) REFERENCES integration (id) ON DELETE SET NULL,
    CONSTRAINT fk_tool_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE channel (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    type          ENUM('own','whatsapp','telegram','discord','api') NULL,
    name          VARCHAR(255) NULL,
    icon_url      VARCHAR(2000) NULL,
    config        JSON NULL,                       
    status        ENUM('active','inactive') NULL DEFAULT 'active',
    created_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_channel_agent (agent_id),
    KEY idx_channel_type (type),
    CONSTRAINT fk_channel_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_channel_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE client (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id            BIGINT UNSIGNED NOT NULL,
    user_id             BIGINT UNSIGNED NOT NULL,
    label               VARCHAR(30) NULL,
    identifier            VARCHAR(255) NULL,
    avatar_url          VARCHAR(2000) NULL,
    profile_url         VARCHAR(2000) NULL,
    metadata             JSON(35) NULL,
    do_not_contact      TINYINT(1) NOT NULL DEFAULT 0,
    created_at          DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_client_agent (agent_id),
    KEY idx_client_user (user_id),
    KEY idx_client_agent_email (agent_id, email),
    KEY idx_client_agent_phone (agent_id, phone),
    CONSTRAINT fk_client_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_client_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE conversation (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    agent_id      BIGINT UNSIGNED NULL,
    user_id       BIGINT UNSIGNED NULL,
    client_id     BIGINT UNSIGNED NULL,
    channel_id    BIGINT UNSIGNED NULL,                   
    external_user_id VARCHAR(255) NULL,            
    external_user_name VARCHAR(255) NULL,
    status        ENUM('open','closed') NULL DEFAULT 'open',
    started_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at     DATETIME NULL,
    last_message_at DATETIME NULL,                 
    created_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_conversation_agent (agent_id, last_message_at),
    KEY idx_conversation_user (user_id),
    KEY idx_conversation_client (client_id),
    CONSTRAINT fk_conversation_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_conversation_channel FOREIGN KEY (channel_id) REFERENCES channel (id) ON DELETE SET NULL,
    CONSTRAINT fk_conversation_client FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE SET NULL,
    CONSTRAINT fk_conversation_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE message (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id  BIGINT UNSIGNED NULL,
    role             ENUM('user','assistant','system','tool') NULL,
    content          MEDIUMTEXT NULL,          
    knowledge_chunks JSON NULL,                    
    tokens_used      INT NULL,
    tool_calls       JSON NULL,                    
    latency_ms       INT NULL,
    created_at       DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_message_conversation (conversation_id, created_at),
    KEY idx_message_agent (agent_id),
    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversation (id) ON DELETE CASCADE,
    CONSTRAINT fk_message_agent FOREIGN KEY (agent_id) REFERENCES agent (id) ON DELETE CASCADE,
    CONSTRAINT fk_message_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE api_key (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NULL,
    name         VARCHAR(255) NULL,            
    key_hash     CHAR(64) NULL,                
    key_prefix   VARCHAR(12) NULL,             
    scopes       JSON NULL,                        
    rate_limit   INT NULL,                         
    last_used_at DATETIME NULL,
    expires_at   DATETIME NULL,
    status       ENUM('active','revoked') NULL DEFAULT 'active',
    created_at   DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_api_key_hash (key_hash),
    KEY idx_api_key_user (user_id),
    CONSTRAINT fk_api_key_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
) ENGINE=InnoDB;