/**
 * GOOGLE PICKER — seletor nativo do Drive
 * -----------------------------------------------------------------------------
 * Carrega `apis.google.com/js/api.js` + `gapi.load('picker')` sob demanda e abre
 * o modal do Google. O access token vem de
 * `GET /integration/user/credentials/{id}?provider=google`.
 *
 * Abre apenas quando o usuário está com a integração ativa; devolve os
 * arquivos escolhidos pelo callback (fechar o diálogo não devolve nada).
 *
 * Como o diálogo do Google é irmão dos modais do app no `<body>`, ele é
 * elevado para cima do modal de edição enquanto está aberto — ver
 * `keepPickerAboveModals`.
 */

import { Env } from './env';

const API_JS_URL = 'https://apis.google.com/js/api.js';

/** Arquivo escolhido no picker — o bastante para listar na seção. */
export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
}

/**
 * PICKER × MODAIS DO APP
 * -----------------------------------------------------------------------------
 * O diálogo do Google nasce como irmão dos nossos modais no `<body>` e o app
 * tem dois travamentos enquanto o modal de edição está aberto:
 *
 * 1. Radix deixa `body { pointer-events: none }` (disableOutsidePointerEvents)
 *    → o picker herda `none` e não recebe clique nenhum;
 * 2. nossos overlays ficam em `z-50` → o picker pode ficar atrás do formulário.
 *
 * Enquanto ele está aberto, sobe do nó do Google até (sem incluir) o `<body>`
 * marcando cada ancestral com `z-index: max` e `pointer-events: auto`. Filho
 * sobrescreve o `none` herdado do body, então o lock do Radix continua valendo
 * para a nossa página — só o picker deixa de ser bloqueado. O `<body>` nunca é
 * tocado, então não há risco de deixar a página sem clique se o picker fechar
 * junto com o modal.
 */
function keepPickerAboveModals(): () => void {
  const seen = new Set<Element>();

  const raise = (node: Node) => {
    if (node.nodeType !== 1) return;

    const start = node as Element;
    const identificador = `${start.id} ${start.getAttribute('class') ?? ''}`;
    // Nenhum iframe e nenhum id/classe "picker" existem no nosso DOM — o teste
    // (o nó ser um iframe, conter um iframe ou se chamar "picker") só pode
    // acertar elementos do Google.
    const ehDoGoogle =
      start.tagName === 'IFRAME' || !!start.querySelector('iframe') || /picker/i.test(identificador);
    if (!ehDoGoogle) return;

    for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
      if (seen.has(el)) continue;
      seen.add(el);
      const style = (el as HTMLElement).style;
      style.setProperty('z-index', '2147483647', 'important');
      style.setProperty('pointer-events', 'auto', 'important');
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(raise);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Nós criados durante o `gapi.load('picker')` (antes do observe) não viriam
  // nos registros do observer: varre o que já existe. Daqui em diante o
  // observer pega tudo, inclusive o que `build()/setVisible()` montar.
  document.body.querySelectorAll('*').forEach(raise);

  return () => observer.disconnect();
}

let pickerApi: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if ((window as any).gapi) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar o script do Google.')));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o script do Google.'));
    document.head.appendChild(script);
  });
}

/** Resolve quando `window.google.picker` está disponível. */
function loadPicker(): Promise<void> {
  if (pickerApi) return pickerApi;

  pickerApi = loadScript(API_JS_URL)
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          const gapi = (window as any).gapi;
          if (!gapi) {
            reject(new Error('Biblioteca do Google não carregou.'));
            return;
          }

          gapi.load('picker', {
            callback: () => {
              if ((window as any).google?.picker) resolve();
              else reject(new Error('Google Picker indisponível.'));
            },
            ontimeout: () => reject(new Error('Tempo esgotado ao carregar o Google Picker.')),
            timeout: 15000,
          });
        })
    )
    .catch((err) => {
      pickerApi = null; // tentar de novo na próxima vez
      throw err;
    });

  return pickerApi;
}

/** Abre o picker; resolve assim que ele aparece. `onPicked` recebe os arquivos escolhidos. */
export async function openDrivePicker(
  accessToken: string,
  onPicked: (docs: DriveDocument[]) => void
): Promise<void> {
  const clientId = Env.get('GOOGLE_CLIENT_ID');
  const apiKey = Env.get('GOOGLE_API_KEY');

  if (!clientId || !apiKey) {
    throw new Error(
      'Google Picker não configurado: defina NEXT_PUBLIC_GOOGLE_CLIENT_ID e NEXT_PUBLIC_GOOGLE_API_KEY no frontend.'
    );
  }

  await loadPicker();
  const pickerNs = (window as any).google.picker;

  // Enquanto o picker estiver aberto, ele fica por cima do modal de edição.
  const stop = keepPickerAboveModals();
  const acoesDeFechamento = [
    pickerNs.Action.PICKED,
    pickerNs.Action.CANCELLED,
    pickerNs.Action.CANCEL,
    pickerNs.Action.ERROR,
  ].filter(Boolean);

  try {
    new pickerNs.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setAppId(clientId)
      .addView(pickerNs.ViewId.DOCS)
      .setCallback((data: any) => {
        if (acoesDeFechamento.includes(data?.action)) stop();

        // Fechar o diálogo dispara ações cujo texto varia entre versões do Picker
        // (CANCELLED/CANCEL/LOADED) — só "PICKED" interessa.
        if (data?.action !== pickerNs.Action.PICKED || !Array.isArray(data.docs)) return;

        onPicked(
          (data.docs as any[]).map((doc) => ({
            id: String(doc.id),
            name: String(doc.name ?? doc.id),
            mimeType: String(doc.type ?? ''),
          }))
        );
      })
      .build()
      .setVisible(true);
  } catch (err) {
    stop();
    throw err;
  }
}
