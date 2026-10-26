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
    access_type: 'online',
    include_granted_scopes: true,
    prompt: 'consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    state: state //mitigar falsificação de solicitação entre google e daosa
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

export function createGoogleDriveClient(credentials) {

  if (!credentials || typeof credentials !== 'object' || !credentials.access_token) {
    throw new Error('Valid Google OAuth credentials with an access token are required.');
  }

  const oauthClient = getGoogleOAuthClient();
  oauthClient.setCredentials(credentials);

  return google.drive({ version: 'v3', auth: oauthClient });

}