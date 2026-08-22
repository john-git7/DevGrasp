import { pipeline } from '@xenova/transformers';

let embedder: any = null;

export async function getLocalEmbedding(textOrTexts: string | string[]): Promise<any> {
  try {
    if (!embedder) {
      console.log('Loading local embedding model: Xenova/all-MiniLM-L6-v2...');
      console.log('👉 Downloading model weights from Hugging Face. This happens ONLY ONCE on the first run and may take a moment depending on your connection...');
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('✅ Model loaded successfully into memory!');
    }
    
    if (Array.isArray(textOrTexts)) {
      // Batch embedding
      const promises = textOrTexts.map(async (text) => {
        const output = await embedder(text, { pooling: 'mean', normalize: true });
        return { values: Array.from(output.data) };
      });
      return await Promise.all(promises);
    } else {
      // Single embedding
      const output = await embedder(textOrTexts, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    }
  } catch (error) {
    console.error('Error generating local embedding:', error);
    throw error;
  }
}
