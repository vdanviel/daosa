import Env from '../util/Env.js';

/**
 * Retorna a URL de autorização do Discord OAuth2.
 * O parâmetro `state` deve ser um JSON stringificado contendo pelo menos:
 *   - integration_id
 *   - user_id
 *   - target_uri (para onde redirecionar após o consentimento)
 *   - antifraud_onboard_code (código de uso único para validar o callback)
 */
export function getDiscordAuthorizationUrl(state) {
  if (typeof state !== 'string' || state.length === 0) {
    throw new Error('A non-empty OAuth state is required.');
  }

  const clientId = Env.getDiscordClientId();
  const redirectUri = Env.getDiscordRedirectUri();

  if (!clientId || !redirectUri) {
    throw new Error('Missing Discord OAuth configuration: DISCORD_CLIENT_ID and DISCORD_REDIRECT_URI must be set.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds guilds.members.read bot applications.commands',
    state: state,
    prompt: 'consent'
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Troca o código de autorização pelo access_token e refresh_token do Discord.
 * Retorna um objeto com: access_token, refresh_token, expires_in, token_type, scope
 */
export async function getDiscordAccessTokens(code) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new Error('A non-empty Discord authorization code is required.');
  }

  const clientId = Env.getDiscordClientId();
  const clientSecret = Env.getDiscordClientSecret();
  const redirectUri = Env.getDiscordRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Discord OAuth configuration.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Discord token exchange failed: ${errorData.error_description || response.statusText}`);
  }

  return response.json();
}

/**
 * Busca as guilds (servidores) que o bot tem acesso usando o bot token.
 */
export async function fetchBotGuilds(botToken) {
  const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: {
      'Authorization': `Bot ${botToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch bot guilds');
  }

  return response.json();
}

/**
 * Busca as guilds do usuário usando o user access token.
 */
export async function fetchUserGuilds(accessToken) {
  const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user guilds');
  }

  return response.json();
}

/**
 * Cria um comando de aplicação (slash command) no Discord.
 */
export async function createApplicationCommand(applicationId, botToken, commandData) {
  const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commandData)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to create command: ${JSON.stringify(errorData)}`);
  }

  return response.json();
}