const Chunk = require('../models/Chunk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getLocalEmbedding } = require('./localEmbedder');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

async function retrieveContext(query, repoUrl = null, embeddingModel = 'gemini-embedding-001') {
  try {
    const isLocal = embeddingModel === 'local-MiniLM';
    let queryVector;

    if (isLocal) {
      queryVector = await getLocalEmbedding(query);
    } else {
      const model = genAI.getGenerativeModel({ model: embeddingModel });
      const embeddingResult = await model.embedContent(query);
      queryVector = embeddingResult.embedding.values;
    }

    // Perform vector search in MongoDB Atlas with native pre-filtering by repoUrl.
    // Previously this fetched 1000 candidates from ALL repos and then filtered with a $match stage,
    // wasting up to 995 candidates from the wrong repos.
    // Now we pass the filter directly into $vectorSearch so Atlas only scores relevant chunks.
    const indexName = isLocal ? 'LocalMiniLM' : 'Devmind';
    const pipeline = [
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
    results.forEach(res => {
      contextStr += `--- File: ${res.filePath} ---\n${res.content}\n\n`;
    });

    return contextStr;
  } catch (error) {
    console.error('Vector Search failed:', error.message || error);
    // If search fails (e.g., index not ready), return empty context so chat still works
    return '';
  }
}

module.exports = { retrieveContext };
