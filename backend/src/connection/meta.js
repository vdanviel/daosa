import Env from '../util/Env.js';

function graphUrl(path, query = {}) {
  const url = new URL(`https://graph.facebook.com/${Env.getMetaGraphVersion()}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  return url;
}

async function graph(path, { method = 'GET', token, query = {} } = {}) {
  const response = await fetch(graphUrl(path, query), {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(method !== 'GET' && { 'Content-Type': 'application/json' })
    },
    ...(method !== 'GET' && { body: JSON.stringify({}) })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    const error = new Error(payload?.error?.message || `Graph API respondeu ${response.status}.`);
    error.status = response.status === 401 || response.status === 403 ? 403 : 400;
    error.meta = payload?.error ?? null;
    throw error;
  }

  return payload;
}

async function exchangeBusinessToken(code) {
  let payload;

  try {
    payload = await graph('/oauth/access_token', {
      query: {
        client_id: Env.getMetaAppId(),
        client_secret: Env.getMetaAppSecret(),
        code
      }
    });
  } catch (error) {
    error.code = 'WHATSAPP_CODE_INVALID';
    error.message = 'O código do Facebook expirou ou já foi usado. Tente conectar novamente.';
    throw error;
  }

  if (!payload?.access_token) {
    const error = new Error('A Meta não devolveu um token para esse código.');
    error.status = 400;
    error.code = 'WHATSAPP_CODE_INVALID';
    throw error;
  }

  return payload.access_token;
}

async function fetchWaba(wabaId, token) {
  try {
    return await graph(`/${wabaId}`, { token, query: { fields: 'name' } });
  } catch (error) {
    error.code = 'WHATSAPP_ASSET_UNAUTHORIZED';
    error.message = 'O token recebido não deu acesso a essa conta do WhatsApp Business.';
    throw error;
  }
}

async function fetchPhoneNumber(phoneNumberId, token) {
  try {
    return await graph(`/${phoneNumberId}`, {
      token,
      query: { fields: 'display_phone_number,verified_name,quality_rating' }
    });
  } catch (error) {
    error.code = 'WHATSAPP_ASSET_UNAUTHORIZED';
    error.message = 'O token recebido não deu acesso a esse número de telefone.';
    throw error;
  }
}

export { exchangeBusinessToken, fetchPhoneNumber, fetchWaba };
