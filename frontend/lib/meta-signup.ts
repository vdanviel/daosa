/**
 * WHATSAPP EMBEDDED SIGNUP — popup da Meta
 * -----------------------------------------------------------------------------
 * Irmão do `google-picker.ts`: carrega o SDK do Facebook sob demanda, abre o
 * Embedded Signup com o Configuration ID e devolve o que o popup entrega.
 *
 * O fluxo vem por dois canais diferentes e o backend precisa dos três valores:
 *
 *   - `response.authResponse.code` → no callback do `FB.login`. Dura 30
 *     segundos e só o backend pode trocá-lo (exige o App Secret);
 *   - `waba_id` e `phone_number_id` → numa mensagem `WA_EMBEDDED_SIGNUP` no
 *     `window.message`, enviada pelo popup. Só existem depois que o cliente
 *     clica em concluir.
 *
 * A mensagem da Meta tem a forma (os IDs ficam ANINHADOS em `data`):
 *
 *   { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH',
 *     data: { waba_id: '…', phone_number_id: '…' } }
 *
 * `event` também pode ser `FINISH_ONLY_WABA`,
 * `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, `ERROR` (erro reportado pela
 * própria Meta) ou um evento de abandono com `data.current_step` (tela em que
 * o cliente desistiu).
 *
 * Por isso a promise resolve somente quando os três chegaram. Fechar o popup
 * sem concluir devolve `null` (não é erro — é o cliente desistindo).
 */

import { Env } from './env';
import { loadScript } from "./utils";

export interface WhatsappSignupAssets {
  /** Código de autorização de uso único — trocado no backend. */
  code: string;
  waba_id: string;
  phone_number_id: string;
}

let sdk: Promise<void> | null = null;

/** Carrega `connect.facebook.net` e inicializa o `FB` com o app id público. */
function loadFacebookSdk(): Promise<void> {
  if (sdk) return sdk;

  sdk = loadScript('https://connect.facebook.net/en_US/sdk.js')
    .then(() => {
      const fb = (window as any).FB;
      if (!fb) throw new Error('Biblioteca do Facebook não carregou.');

      fb.init({
        appId: Env.get('META_APP_ID'),
        cookie: true,
        xfbml: false,
        version: Env.get('META_GRAPH_API_VERSION') || 'v27.0',
      });
    })
    .catch((err) => {
      sdk = null; // tentar de novo na próxima vez
      throw err;
    });

  return sdk;
}

/**
 * Abre o Embedded Signup. Resolve com os dados da conexão, `null` se o cliente
 * fechou o popup, ou rejeita quando não dá para concluir.
 *
 * Precisa ser chamada dentro do clique do usuário: é o `FB.login` que abre a
 * janela, e o navegador bloqueia popup aberto depois de um `await`.
 */
export async function launchWhatsappSignup(): Promise<WhatsappSignupAssets | null> {
  const appId = Env.get('META_APP_ID');
  const configId = Env.get('META_CONFIG_ID');

  if (!appId || !configId) {
    throw new Error(
      'Embedded Signup não configurado: defina NEXT_PUBLIC_META_APP_ID e NEXT_PUBLIC_META_LOGIN_CONFIG_ID no frontend.'
    );
  }

  await loadFacebookSdk();

  return new Promise((resolve, reject) => {
    const fb = (window as any).FB;
    let code: string | null = null;
    const assets: Partial<WhatsappSignupAssets> = {};
    let timer: number | undefined;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (timer !== undefined) window.clearTimeout(timer);
    };

    /** Resolve só com os três valores — dois canais, um resultado. */
    const tryResolve = () => {
      if (!code || !assets.waba_id || !assets.phone_number_id) return false;

      cleanup();
      resolve({ code, waba_id: assets.waba_id, phone_number_id: assets.phone_number_id });
      return true;
    };

    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('facebook.com')) return;

      let message: any;
      try {
        message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return; // mensagem de outra origem que não é JSON nosso
      }

      if (message?.type !== 'WA_EMBEDDED_SIGNUP') return;

      // Depuração: mostra o evento cru da Meta no console (remover em produção).
      console.log('[embedded-signup] message event:', message);

      // `waba_id` e `phone_number_id` vêm ANINHADOS em `message.data`; a raiz
      // é só fallback para o formato antigo.
      const payload = message.data ?? message;

      // Abandono em alguma tela (ex.: fechou na escolha do número): não é
      // erro, é o cliente desistindo — mesmo comportamento do popup fechado.
      if (message.event && !['FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'].includes(message.event)) {
        if (message.event === 'ERROR') {
          cleanup();
          reject(new Error(payload?.error_message || 'A Meta reportou um erro durante o cadastro. Tente novamente.'));
          return;
        }

        cleanup();
        resolve(null);
        return;
      }

      if (payload?.waba_id) assets.waba_id = String(payload.waba_id);
      if (payload?.phone_number_id) assets.phone_number_id = String(payload.phone_number_id);

      tryResolve();
    };

    window.addEventListener('message', onMessage);

    fb.login(
      (response: any) => {
        // Popup fechado sem concluir — não é erro, é desistência.
        if (!response?.authResponse) {
          cleanup();
          resolve(null);
          return;
        }

        if (!response.authResponse.code) {
          cleanup();
          reject(new Error('O Facebook não devolveu um código de autorização. Tente novamente.'));
          return;
        }

        code = String(response.authResponse.code);

        if (tryResolve()) return;
          
        // O code costuma chegar depois da mensagem de sessão; sem os IDs o backend
        // não sabe qual conta e número guardar.
        timer = window.setTimeout(() => {
          cleanup();
          reject(new Error('O Facebook não devolveu os dados da conta do WhatsApp. Tente novamente.'));
        }, 10000);
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
            featureType: 'WHATSAPP_BUSINESS_APP_ONBOARDING',
            sessionInfoVersion: 3,
        },
      }
    );
  });
}
