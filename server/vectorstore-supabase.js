/**
 * Supabase Vector Store Implementation
 * 
 * Uses PostgreSQL with pgvector extension for:
 * - Fast vector similarity search (indexed)
 * - Scalable storage
 * - SQL-based filtering
 * 
 * Falls back to local JSON store if Supabase not configured
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');
const localVectorStore = require('./vectorstore');

const TABLE_NAME = 'content_chunks';

/**
 * Add documents to Supabase vector store
 * @param {Array} documents - Array of {id, document, embedding, metadata}
 */
async function addDocuments(documents) {
  if (!isSupabaseConfigured()) {
    console.log('📁 Using local vector store (Supabase not configured)');
    return localVectorStore.addDocuments(documents);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return localVectorStore.addDocuments(documents);
  }

  try {
    // Format documents for Supabase
    const rows = documents.map(doc => ({
      id: doc.id,
      source_file: doc.metadata.filename || 'unknown',
      chunk_index: doc.metadata.chunkId || 0,
      content: doc.document,
      embedding: doc.embedding, // pgvector accepts array directly
      metadata: doc.metadata
    }));

    // Insert in batches of 100 to avoid payload limits
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from(TABLE_NAME)
        .upsert(batch, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        throw error;
      }
      
      console.log(`   ✓ Inserted ${Math.min(i + batchSize, rows.length)}/${rows.length} chunks`);
    }

    console.log(`✅ Added ${documents.length} documents to Supabase`);
  } catch (error) {
    console.error('❌ Error adding documents to Supabase:', error.message);
    throw error;
  }
}

/**
 * Query similar documents using pgvector
 * @param {Array} queryEmbedding - Query embedding vector
 * @param {number} nResults - Number of results to return
 * @returns {Object} Results in ChromaDB-compatible format
 */
async function querySimilar(queryEmbedding, nResults = 5) {
  if (!isSupabaseConfigured()) {
    return localVectorStore.querySimilar(queryEmbedding, nResults);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return localVectorStore.querySimilar(queryEmbedding, nResults);
  }

  try {
    // Use Supabase RPC function for vector similarity search
    const { data, error } = await supabase.rpc('match_content_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.0, // Return all, we filter by threshold in rag.js
      match_count: nResults
    });

    if (error) {
      console.error('❌ Supabase vector search error:', error.message);
      // Fall back to local store
      return localVectorStore.querySimilar(queryEmbedding, nResults);
    }

    if (!data || data.length === 0) {
      return {
        documents: [[]],
        ids: [[]],
        distances: [[]],
        metadatas: [[]]
      };
    }

    // Format response to match ChromaDB format (for compatibility)
    return {
      documents: [data.map(row => row.content)],
      ids: [data.map(row => row.id)],
      distances: [data.map(row => 1 - row.similarity)], // Convert similarity to distance
      metadatas: [data.map(row => ({
        filename: row.source_file,
        chunkId: row.chunk_index,
        ...row.metadata
      }))]
    };
  } catch (error) {
    console.error('❌ Error querying Supabase:', error.message);
    // Fall back to local store
    return localVectorStore.querySimilar(queryEmbedding, nResults);
  }
}

/**
 * Get count of documents in vector store
 * @returns {number} Document count
 */
async function getCount() {
  if (!isSupabaseConfigured()) {
    return localVectorStore.getCount();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return localVectorStore.getCount();
  }

  try {
    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error getting count from Supabase:', error.message);
    return localVectorStore.getCount();
  }
}

/**
 * Delete all documents from vector store
 */
async function deleteCollection() {
  if (!isSupabaseConfigured()) {
    return localVectorStore.deleteCollection();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return localVectorStore.deleteCollection();
  }

  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .neq('id', ''); // Delete all rows

    if (error) {
      throw error;
    }

    console.log('🗑️  Deleted all documents from Supabase');
  } catch (error) {
    console.error('❌ Error deleting from Supabase:', error.message);
    throw error;
  }
}

/**
 * Initialize vector store (create table if needed)
 */
async function initializeVectorStore() {
  if (!isSupabaseConfigured()) {
    return localVectorStore.initializeVectorStore();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return localVectorStore.initializeVectorStore();
  }

  // Table creation is handled by Supabase migrations
  // Just verify connection
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Supabase table check failed:', error.message);
      console.log('💡 Make sure to run the SQL migration in Supabase dashboard');
      throw error;
    }

    console.log('✅ Supabase vector store ready');
  } catch (error) {
    console.error('❌ Error initializing Supabase vector store:', error.message);
    throw error;
  }
}

/**
 * Health check for vector store
 * @returns {Object} Health status
 */
async function healthCheck() {
  const status = {
    provider: isSupabaseConfigured() ? 'supabase' : 'local',
    connected: false,
    documentCount: 0
  };

  try {
    const count = await getCount();
    status.connected = true;
    status.documentCount = count;
  } catch (error) {
    status.error = error.message;
  }

  return status;
}

module.exports = {
  addDocuments,
  querySimilar,
  getCount,
  deleteCollection,
  initializeVectorStore,
  healthCheck
};

