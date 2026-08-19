require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const RepoStatus = require('./models/RepoStatus');
const Chunk = require('./models/Chunk');
const { retrieveContext } = require('./services/retriever'); 

async function run() {
  const startTime = Date.now();
  try {
    await mongoose.connect(process.env.MONGO_URI, { family: 4 });
    console.log('Connected to MongoDB in', Date.now() - startTime, 'ms');
    
    const repos = await RepoStatus.find();
    console.log('Repositories indexed:', repos.map(r => r.repoUrl));
    
    let totalFiles = 0;
    for (const repo of repos) {
      totalFiles += repo.indexedFiles || repo.totalFiles || 0;
    }
    
    const totalChunks = await Chunk.countDocuments();
    
    console.log('--- METRICS ---');
    console.log('Total Repos:', repos.length);
    console.log('Total Files Indexed:', totalFiles);
    console.log('Total Chunks:', totalChunks);
    
    const retrieveStart = Date.now();
    try {
      const { getLocalEmbedding } = require('./services/localEmbedder');
      const embedding = await getLocalEmbedding("How does authentication work?");
      if (embedding && embedding.length > 0) {
        const queryVector = embedding[0].values;
        const pipeline = [
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryVector,
              numCandidates: 100,
              limit: 5
            }
          },
          {
            $project: {
              _id: 0,
              embedding: 0,
              score: { $meta: "vectorSearchScore" }
            }
          }
        ];
        const results = await Chunk.aggregate(pipeline);
        console.log(`Vector search returned ${results.length} results in ${Date.now() - retrieveStart}ms`);
      }
    } catch(e) {
      console.log('Could not test retrieval speed:', e.message);
    }
    
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
