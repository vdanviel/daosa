/**
 * Proxy da API — TODAS as chamadas do SPA passam por aqui.
 *
 * O arquivo central `lib/api.ts` faz fetch relativo para `/api/v1/...`.
 * Este route handler encaminha para o backend em `BACKEND_URL` (runtime),
 * evitando problemas de CORS e de DNS do navegador (ex.: backend-daosa).
 */

export const dynamic = 'force-dynamic';

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/+$/, '');

async function proxy(request: Request, method: string) {
  const { pathname, search } = new URL(request.url);
  const target = `${BACKEND_URL}${pathname.replace(/^\/api/, '')}${search}`;

  const headers = new Headers();
  const auth = request.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);
  // Preserva o content-type original (multipart/form-data com boundary no upload).
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const init: RequestInit = { method, headers, cache: 'no-store' };
  // Body só quando existe: enviar `''` em DELETE/GET quebra o undici
  // (UND_ERR_REQ_CONTENT_LENGTH_MISMATCH) e o proxy devolvia 502.
  if (method !== 'GET' && method !== 'HEAD') {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  try {
    const res = await fetch(target, init);
    const outHeaders = new Headers();
    const contentType = res.headers.get('content-type');
    if (contentType) outHeaders.set('Content-Type', contentType);
    return new Response(res.body, { status: res.status, headers: outHeaders });
  } catch (err: any) {
    console.error('[proxy] falha no fetch:', method, target, err?.message, '| causa:', err?.cause?.code ?? err?.cause?.message ?? err?.cause);
    return Response.json(
      { type: 'NetworkError', error: 'Não foi possível conectar à API.' },
      { status: 502 }
    );
  }
}

export const GET = (req: Request) => proxy(req, 'GET');
export const POST = (req: Request) => proxy(req, 'POST');
export const PUT = (req: Request) => proxy(req, 'PUT');
export const PATCH = (req: Request) => proxy(req, 'PATCH');
export const DELETE = (req: Request) => proxy(req, 'DELETE');
