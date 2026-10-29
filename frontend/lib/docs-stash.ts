/**
 * STASH DE DOCUMENTOS — preserva os arquivos locais durante o OAuth
 * -----------------------------------------------------------------------------
 * A ida ao consentimento do Google navega para fora do SPA e o React desmonta.
 * Antes de sair, os documentos já anexados são guardados aqui (IndexedDB aceita
 * `File` sem transformar em base64) e devolvidos no mount da seção.
 *
 * Falha de armazenamento não bloqueia o fluxo: a lista simplesmente volta vazia.
 */

const DB_NAME = 'daosa-documents';
const STORE_NAME = 'stash';
const KEY = 'pending';

export interface AgentDocument {
  id: string;
  name: string;
  origin: 'drive' | 'upload';
  size?: number;
  file?: File;
  /** Status da knowledge source no backend: pending | processing | processed | failed. */
  status?: string;
  /** ID da source no backend (`knowledge_source.id`) — docs locais ainda não têm. */
  sourceId?: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/** Guarda os documentos antes de navegar para o consentimento. */
export async function stashDocs(docs: AgentDocument[]): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const request = store(db, 'readwrite').put(docs, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  db.close();
}

/** Lê e limpa o stash — só pode ser consumido uma vez. */
export async function takeStashedDocs(): Promise<AgentDocument[]> {
  try {
    const db = await openDb();

    const docs = await new Promise<AgentDocument[]>((resolve, reject) => {
      const request = store(db, 'readonly').get(KEY);
      request.onsuccess = () => resolve((request.result as AgentDocument[]) ?? []);
      request.onerror = () => reject(request.error);
    });

    await new Promise<void>((resolve, reject) => {
      const request = store(db, 'readwrite').delete(KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    return docs;
  } catch {
    return [];
  }
}
