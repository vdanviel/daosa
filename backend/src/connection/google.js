import { google } from 'googleapis';
import Env from '../util/Env.js';

function getGoogleOAuthClient() {
  const clientId = Env.getGoogleClientId();
  const clientSecret = Env.getGoogleClientSecret();
  const redirectUri = Env.getGoogleRedirectUri();

  const missingConfiguration = [
    ['GOOGLE_CLIENT_ID', clientId],
    ['GOOGLE_CLIENT_SECRET', clientSecret],
    ['GOOGLE_REDIRECT_URI', redirectUri]
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missingConfiguration.length > 0) {
    throw new Error(`Missing Google OAuth configuration: ${missingConfiguration.join(', ')}.`);
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthorizationUrl(state) {
  if (typeof state !== 'string' || state.length === 0) {
    throw new Error('A non-empty OAuth state is required.');
  }

  return getGoogleOAuthClient().generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    state: state // mitigates request forgery between Google and daosa
  });
}

export async function getUserAcessTokens(code) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new Error('A non-empty Google authorization code is required.');
  }

  const oauthClient = getGoogleOAuthClient();
  const { tokens } = await oauthClient.getToken(code);
  return tokens;
}

/**
 * @param {import('../models/Integration.js').Integration} integration
 */
export async function refreshGoogleCredentials(integration) {

  if (!integration) throw new Error('Invalid integration.', { status: 500 });

  if (!integration.credentials || integration.status === 'expired') {
    integration.status = 'expired';
    await integration.save();

    const error = new Error('Google account needs to be connected again.');
    error.code = 'REAUTH_GOOGLE_ACCOUNT';
    error.status = 401;
    throw error;
  }

  const credentials = JSON.parse(integration.credentials);

  if (!credentials.refresh_token) {
    integration.status = 'expired';
    await integration.save();

    const error = new Error('Google account needs to be connected again.');
    error.code = 'REAUTH_GOOGLE_ACCOUNT';
    error.status = 401;
    throw error;
  }

  const accessExpired = !credentials.expiry_date || Date.now() >= credentials.expiry_date;

  if (!accessExpired && credentials.access_token) {
    return { access_token: credentials.access_token };
  }

  const oauthClient = getGoogleOAuthClient();

  delete credentials.expiry_date;
  oauthClient.setCredentials(credentials);

  try {
    const { credentials: refreshedCredentials } = await oauthClient.refreshAccessToken();

    if (!refreshedCredentials.access_token) throw new Error('Google did not return an access token.');

    integration.credentials = JSON.stringify({
      access_token: refreshedCredentials.access_token,
      refresh_token: refreshedCredentials.refresh_token || credentials.refresh_token,
      expiry_date: refreshedCredentials.expiry_date
    });

    const { access_token, expiry_date, refresh_token, ...metadata } = refreshedCredentials;//splitando os dados para pegar todos MENOS access_token/expiry_date/refresh_token...
    integration.metadata = metadata;

    integration.status = 'active';
    await integration.save();

    console.log(refreshedCredentials)

    return { access_token: refreshedCredentials.access_token };

  } catch (err) {

    const invalidGrant = err?.response?.data?.error === 'invalid_grant' || err?.message === 'invalid_grant';
    if (!invalidGrant) throw err;

    integration.status = 'expired';
    await integration.save();

    const error = new Error('Google account needs to be connected again.');
    error.code = 'REAUTH_GOOGLE_ACCOUNT';
    error.status = 401;
    throw error;
  }
}
