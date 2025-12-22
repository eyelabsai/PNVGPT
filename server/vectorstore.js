/**
 * Local Vector Store Implementation
 * 
 * Simple file-based vector storage with cosine similarity search
 * No external server needed - everything runs locally
 */

const fs = require('fs').promises;
const path = require('path');

const VECTOR_STORE_PATH = path.join(__dirname, '../vector-store');
const COLLECTION_FILE = path.join(VECTOR_STORE_PATH, 'collection.json');

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Initialize vector store directory
 */
async function initializeVectorStore() {
  try {
    await fs.mkdir(VECTOR_STORE_PATH, { recursive: true });
    console.log('✅ Vector store directory ready');
  } catch (error) {
    console.error('❌ Error creating vector store:', error.message);
    throw error;
  }
}

/**
 * Save collection to disk
 */
async function saveCollection(documents) {
  try {
    await fs.writeFile(
      COLLECTION_FILE,
      JSON.stringify(documents, null, 2),
      'utf-8'
    );
    console.log(`✅ Saved ${documents.length} documents to vector store`);
  } catch (error) {
    console.error('❌ Error saving collection:', error.message);
    throw error;
  }
}

/**
 * Load collection from disk
 */
async function loadCollection() {
  try {
    const data = await fs.readFile(COLLECTION_FILE, 'utf-8');
    const documents = JSON.parse(data);
    console.log(`✅ Loaded ${documents.length} documents from vector store`);
    return documents;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('⚠️  No vector store found. Run: npm run index');
      return [];
    }
    console.error('❌ Error loading collection:', error.message);
    throw error;
  }
}

/**
 * Add documents to collection
 */
async function addDocuments(documents) {
  await initializeVectorStore();
  await saveCollection(documents);
}

/**
 * Query similar documents
 */
async function querySimilar(queryEmbedding, nResults = 3) {
  const documents = await loadCollection();
  
  if (documents.length === 0) {
    return {
      documents: [[]],
      ids: [[]],
      distances: [[]],
      metadatas: [[]]
    };
  }
  
  // Calculate similarities
  const results = documents.map(doc => ({
    ...doc,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    distance: 1 - cosineSimilarity(queryEmbedding, doc.embedding)
  }));
  
  // Sort by similarity (descending)
  results.sort((a, b) => b.similarity - a.similarity);
  
  // Take top N
  const topResults = results.slice(0, nResults);
  
  // Format like ChromaDB response
  return {
    documents: [topResults.map(r => r.document)],
    ids: [topResults.map(r => r.id)],
    distances: [topResults.map(r => r.distance)],
    metadatas: [topResults.map(r => r.metadata)]
  };
}

/**
 * Get collection count
 */
async function getCount() {
  const documents = await loadCollection();
  return documents.length;
}

/**
 * Delete collection
 */
async function deleteCollection() {
  try {
    await fs.unlink(COLLECTION_FILE);
    console.log('🗑️  Deleted existing collection');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  initializeVectorStore,
  addDocuments,
  querySimilar,
  getCount,
  deleteCollection
};




