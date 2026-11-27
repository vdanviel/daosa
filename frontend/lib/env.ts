const values = Object.freeze({
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL,
  /** OAuth client id do app Google (usado como appId do Picker). */
  GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  /** API key do Google Cloud com a Google Picker API habilitada. */
  GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  /** App id do app Meta (inicialização do SDK do Facebook). */
  META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
  /** Configuration ID do Facebook Login for Embedded Signup. */
  META_CONFIG_ID: process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID,
  /** Versão da Graph API usada pelo SDK da Meta. */
  META_GRAPH_API_VERSION: process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION,
});

export const Env = Object.freeze({
  get(key: keyof typeof values) {
    if (!(key in values)) {
      throw new Error(`Unknown public environment key: ${key}`);
    }

    return values[key];
  },
});