import dotenv from 'dotenv';

dotenv.config();

class Env {

  static getAppName() { return process.env.APP_NAME || 'Company'; }
  static getCurrentEnvironment() { return process.env.CURRENT_ENVIRONMENT || 'dev'; }
  static getDbName() { return process.env.DB_NAME || ''; }
  static getDbUser() { return process.env.DB_USER || ''; }
  static getDbPassword() { return process.env.DB_PASSWORD || ''; }
  static getDbHost() { return process.env.DB_HOST || '127.0.0.1'; }
  static getDbPort() { return Number(process.env.DB_PORT || 3306); }
  static getDbDialect() { return process.env.DB_DIALECT || 'mysql'; }
  static getJwtSecret() { return process.env.JWT_SECRET; }
  static getMailHost() { return process.env.MAIL_HOST; }
  static getMailPort() { return process.env.MAIL_PORT; }
  static getMailUsername() { return process.env.MAIL_USERNAME; }
  static getMailPassword() { return process.env.MAIL_PASSWORD; }
  static getMailFromAddress() { return process.env.MAIL_FROM_ADDRESS; }
  static getMailFromName() { return process.env.MAIL_FROM_NAME; }
  static getPort() { return Number(process.env.PORT || 3000); }
  static getSessionSecretPass() { return process.env.SESSION_SECRET_PASS; }
  static getSpaApplicationUrl() { return process.env.SPA_APPLICATION_URL; }
  static getLlmProvider() { return process.env.LLM_PROVIDER; }
  static getLlmUrl() { return process.env.LLM_BASE_URL; }
  static getLlmModel() { return process.env.LLM_MODEL; }
  static getllmApiKey() { return process.env.LLM_API_KEY; }
  static getEmbeddingLlmProvider() { return process.env.EMBEDDING_LLM_PROVIDER; }
  static getEmbeddingLlmUrl() { return process.env.EMBEDDING_LLM_BASE_URL; }
  static getEmbeddingLlmModel() { return process.env.EMBEDDING_LLM_MODEL; }
  static getEmbeddingApiKey() { return process.env.EMBEDDING_LLM_API_KEY; }
  static getEmbeddingLlmDimensions() {
    const value = process.env.EMBEDDING_LLM_DIMENSIONS?.trim();
    if (!value) return undefined;

    const dimensions = Number(value);
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error('EMBEDDING_LLM_DIMENSIONS must be a positive integer.');
    }

    return dimensions;
  }
  static getInputChunkLimit() { return Number(process.env.INPUT_CHUNK_LIMIT); }
  static getInputOverlap() { return Number(process.env.INPUT_OVERLAP); }
  static getRedisHostname() { return process.env.REDIS_HOSTNAME; }
  static getRedisPort() { return process.env.REDIS_PORT; }
  static getRedisPassword() { return process.env.REDIS_PASSWORD; }
  static getQdrantHost() { return process.env.QDRANT_HOST || process.env.QDRANT_URL || 'localhost'; }
  static getQdrantApiKey() { return process.env.QDRANT_API_KEY; }
  static getQdrantPort() { return Number(process.env.QDRANT_PORT || 6333); }
  static getQdrantCollection() { return process.env.QDRANT_COLLECTION || 'daosa'; }
  static getGoogleClientId() { return process.env.GOOGLE_CLIENT_ID; }
  static getGoogleClientSecret() { return process.env.GOOGLE_CLIENT_SECRET; }
  static getGoogleRedirectUri() { return process.env.GOOGLE_REDIRECT_URI; }
  static getUploadFileSizeLimit() { return process.env.UPLOAD_FILE_SIZE_LIMIT; }
  static getUploadMaxFilesLimit() { return process.env.UPLOAD_MAX_FILE_REQUEST_LIMIT; }

  static validate() {
    const weakSecrets = [
      ['JWT_SECRET', this.getJwtSecret()],
      ['SESSION_SECRET_PASS', this.getSessionSecretPass()]
    ].filter(([, secret]) => {
      return typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32;
    }).map(([key]) => key);

    if (weakSecrets.length > 0) {
      throw new Error(
        `Invalid environment configuration: ${weakSecrets.join(', ')} must each contain at least 32 bytes of random data.`
      );
    }

    const port = this.getPort();
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Invalid environment configuration: PORT must be an integer between 1 and 65535.');
    }
  }

}

export default Env;