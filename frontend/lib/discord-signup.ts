/**
 * DISCORD OAUTH2 — fluxo de redirect padrão
 * -----------------------------------------------------------------------------
 * Diferente do WhatsApp (Embedded Signup com popup), o Discord usa o fluxo
 * OAuth2 padrão: o usuário é redirecionado para o Discord, autoriza, e volta
 * para o callback do backend que redireciona de volta para o frontend.
 *
 * Este módulo centraliza a lógica de iniciar o fluxo OAuth do Discord.
 */

import { Env } from './env';

/**
 * Inicia o fluxo de conexão com o Discord.
 * Redireciona o usuário para a URL de autorização do Discord.
 *
 * @param returnPath - Caminho para onde o backend deve redirecionar após o callback (ex.: '/agents/123/edit')
 */
export function launchDiscordSignup(returnPath: string = '/'): void {
  const clientId = Env.get('DISCORD_CLIENT_ID');

  if (!clientId) {
    throw new Error(
      'Discord OAuth não configurado: defina NEXT_PUBLIC_DISCORD_CLIENT_ID no frontend.'
    );
  }

  // Chama o backend para preparar a integração e obter o link de consentimento
  const baseUrl = (Env.get('API_BASE_URL') || '/api').replace(/\/+$/, '') + '/v1';
  const url = `${baseUrl}/discord/connect`;

  // Faz a requisição para obter o link de consentimento
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`
    },
    body: JSON.stringify({ return_path: returnPath })
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao preparar conexão com Discord.');
      }
      return res.json();
    })
    .then((data) => {
      if (data.d_consent_link) {
        // Redireciona para o Discord
        window.location.href = data.d_consent_link;
      } else {
        throw new Error('Link de consentimento não retornado pelo backend.');
      }
    })
    .catch((err) => {
      console.error('[discord-signup] Erro ao iniciar fluxo:', err);
      throw err;
    });
}

/**
 * Verifica se a URL atual contém parâmetros de retorno do OAuth do Discord.
 * Útil para detectar se o usuário acabou de voltar do Discord.
 */
export function isDiscordOAuthReturn(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('code') && params.has('state');
}

/**
 * Extrai os parâmetros do OAuth do Discord da URL atual.
 * Retorna null se não for um retorno do OAuth.
 */
export function getDiscordOAuthParams(): { code: string; state: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (code && state) {
    return { code, state };
  }
  return null;
}