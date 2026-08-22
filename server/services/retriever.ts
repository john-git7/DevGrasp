import Chunk from '../models/Chunk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getLocalEmbedding } from './localEmbedder';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || '');

export async function retrieveContext(query: string, repoUrl: string | null = null, embeddingModel = 'gemini-embedding-001'): Promise<string> {
  try {
    const isLocal = embeddingModel === 'local-MiniLM';
    let queryVector: number[];

    if (isLocal) {
      queryVector = await getLocalEmbedding(query);
    } else {
      const model = genAI.getGenerativeModel({ model: embeddingModel });
      const embeddingResult = await model.embedContent(query);
      queryVector = embeddingResult.embedding.values;
    }

    // Perform vector search in MongoDB Atlas with native pre-filtering by repoUrl.
    const indexName = isLocal ? 'LocalMiniLM' : 'Devmind';
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: indexName,
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 150,
          limit: 10,
          // Pre-filter: only score chunks from the selected repo
          ...(repoUrl ? { filter: { repoUrl: { $eq: repoUrl } } } : {})
        }
      },
      {
        // Remove the embedding array from results to save bandwidth (keeping only text)
        $project: {
          _id: 0,
          filePath: 1,
          content: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    const results = await Chunk.aggregate(pipeline);

    if (results.length === 0) return '';

    let contextStr = "Here are some relevant code snippets from the user's repository:\n\n";
    results.forEach((res: any) => {
      contextStr += `--- File: ${res.filePath} ---\n${res.content}\n\n`;
    });

    return contextStr;
  } catch (error: any) {
    console.error('Vector Search failed:', error.message || error);
    // If search fails (e.g., index not ready), return empty context so chat still works
    return '';
  }
}
