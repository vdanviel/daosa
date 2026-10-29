import { QdrantClient } from "@qdrant/qdrant-js";
import Env from "../util/Env.js";

export const qdrantConfig = {
    host: Env.getQdrantHost() || "localhost",
    apiKey: Env.getQdrantApiKey(),
    port: Number(Env.getQdrantPort() || 6333),
    https: false,
    checkCompatibility:false
}

export const qdrant = new QdrantClient(qdrantConfig);

/** Cria a coleção se não existir. Chamar antes do primeiro upsert. */
export async function ensureQdrantCollections() {
  const { exists } = await qdrant.collectionExists(Env.getQdrantCollection());
  if (!exists) {
    await qdrant.createCollection(Env.getQdrantCollection(), {
      vectors: { size: Number(Env.getEmbeddingLlmDimensions()), distance: 'Cosine' }
    });
  }
}