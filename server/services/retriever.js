const Chunk = require('../models/Chunk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

async function retrieveContext(query, repoUrl = null) {
  try {
    // 1. Embed the query to get its 768-dimensional vector
    const embeddingResult = await fallbackModel.embedContent(query);
    const queryVector = embeddingResult.embedding.values;

    // 2. Perform vector search in MongoDB
    // Note: We use "Devmind" as the index name because that is what the user named it in Atlas UI.
    const pipeline = [
      {
        $vectorSearch: {
          index: 'Devmind', 
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 100, // Get 100 candidates to filter down
          limit: 100 // Temporarily get 100 so we can filter by repo
        }
      }
    ];

    // Optional: Filter by specific repository if one was selected
    if (repoUrl) {
      pipeline.push({
        $match: { repoUrl: repoUrl }
      });
    }

    // Now slice the top 5 matches
    pipeline.push(
      { $limit: 5 },
      {
        // Remove the embedding array from the results to save bandwidth, keeping only text
        $project: {
          _id: 0,
          filePath: 1,
          content: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    );

    const results = await Chunk.aggregate(pipeline);

    // 3. Format the context into a string
    if (results.length === 0) return "";
    
    let contextStr = "Here are some relevant code snippets from the user's repository:\n\n";
    results.forEach(res => {
      // We append each chunk with its file path so Gemini knows which file it's looking at
      contextStr += `--- File: ${res.filePath} ---\n${res.content}\n\n`;
    });

    return contextStr;
  } catch (error) {
    console.error("Vector Search failed:", error);
    // If search fails (e.g., index not ready), just return empty context so chat still works
    return "";
  }
}

module.exports = { retrieveContext };
