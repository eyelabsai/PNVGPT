/**
 * RAG (Retrieval-Augmented Generation) Logic
 * 
 * Handles:
 * - Text embedding with OpenAI
 * - Vector search with ChromaDB
 * - Answer generation with GPT-4o-mini
 */

const { OpenAI } = require('openai');
const { querySimilar, getCount } = require('./vectorstore');
const { generatePrompt, getFallbackResponse, hasRelevantInformation, isGreeting, getGreetingResponse } = require('./prompt');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const GPT_MODEL = 'gpt-4o-mini';
const COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || 'faq_collection';
const TOP_K_RESULTS = 3;
const SIMILARITY_THRESHOLD = 0.3; // Minimum similarity score to consider relevant

let initialized = false;

/**
 * Initialize local vector store
 */
async function initializeCollection() {
  if (initialized) {
    return true;
  }

  try {
    const count = await getCount();
    if (count === 0) {
      console.error(`❌ Vector store is empty. Please run 'npm run index' first.`);
      throw new Error('Vector database not initialized. Run indexing script first.');
    }
    console.log(`✅ Connected to local vector store: ${count} documents`);
    initialized = true;
    return true;
  } catch (error) {
    console.error(`❌ Error initializing vector store:`, error.message);
    throw error;
  }
}

/**
 * Generate embeddings for text using OpenAI
 * @param {string} text - Text to embed
 * @returns {Promise<Array<number>>} Embedding vector
 */
async function embedText(text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Retrieve most relevant chunks from vector database
 * @param {string} query - User's question
 * @returns {Promise<Array>} Array of relevant chunks with metadata
 */
async function retrieveRelevant(query) {
  try {
    // Ensure vector store is initialized
    if (!initialized) {
      await initializeCollection();
    }

    // Generate embedding for the query
    const queryEmbedding = await embedText(query);

    // Query local vector store for similar chunks
    const results = await querySimilar(queryEmbedding, TOP_K_RESULTS);

    // Parse and format results
    const chunks = [];
    
    if (results.documents && results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        const metadata = results.metadatas[0][i];
        const distance = results.distances[0][i];
        const similarity = 1 - distance; // Convert distance to similarity

        // Only include chunks above similarity threshold
        if (similarity >= SIMILARITY_THRESHOLD) {
          chunks.push({
            id: results.ids[0][i],
            text: results.documents[0][i],
            filename: metadata.filename || 'unknown',
            chunkId: metadata.chunkId || '',
            similarity: similarity.toFixed(4)
          });
        }
      }
    }

    console.log(`📚 Retrieved ${chunks.length} relevant chunks (threshold: ${SIMILARITY_THRESHOLD})`);
    return chunks;
  } catch (error) {
    console.error('❌ Error retrieving relevant chunks:', error.message);
    throw error;
  }
}

/**
 * Generate answer using GPT-4o-mini with retrieved context
 * @param {string} question - User's question
 * @param {Array} chunks - Retrieved relevant chunks
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<Object>} Generated answer and metadata
 */
async function generateAnswerFromChunks(question, chunks, conversationHistory = []) {
  try {
    // If no relevant chunks found, return fallback
    if (!chunks || chunks.length === 0) {
      return {
        answer: getFallbackResponse(),
        chunks: [],
        usedFallback: true
      };
    }

    // Combine chunk texts
    const retrievedText = chunks
      .map((chunk, idx) => `[Source ${idx + 1}: ${chunk.filename}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    // Check if we have relevant information
    if (!hasRelevantInformation(retrievedText)) {
      return {
        answer: getFallbackResponse(),
        chunks: chunks,
        usedFallback: true
      };
    }

    // Generate prompt with safety rules
    const fullPrompt = generatePrompt(question, retrievedText);

    // Build messages array like ChatGPT
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful FAQ assistant for a refractive surgery practice. Only answer based on the provided information from our FAQ database. Use conversation history to understand context and pronouns like "this", "it", "that", etc.'
      }
    ];

    // Add conversation history (last 5 messages for context)
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-5).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Add current question with retrieved context
    messages.push({
      role: 'user',
      content: fullPrompt
    });

    // Call GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: messages,
      temperature: 0.3, // Lower temperature for more consistent, factual responses
      max_tokens: 300,
      top_p: 0.9
    });

    const answer = completion.choices[0].message.content.trim();

    return {
      answer: answer,
      chunks: chunks,
      usedFallback: false,
      model: GPT_MODEL,
      tokensUsed: completion.usage.total_tokens
    };
  } catch (error) {
    console.error('❌ Error generating answer:', error.message);
    throw error;
  }
}

/**
 * Main RAG pipeline: embed query → retrieve → generate answer
 * @param {string} question - User's question
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<Object>} Complete response with answer and metadata
 */
async function generateAnswer(question, conversationHistory = []) {
  const startTime = Date.now();

  try {
    // Validate input
    if (!question || question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }

    // Check if it's a greeting or small talk - respond naturally without searching
    if (isGreeting(question)) {
      const greetingResponse = getGreetingResponse(question);
      return {
        answer: greetingResponse,
        chunks: [],
        usedFallback: false,
        isGreeting: true,
        responseTime: Date.now() - startTime
      };
    }

    // Retrieve relevant chunks
    const chunks = await retrieveRelevant(question);

    // Generate answer with conversation context
    const result = await generateAnswerFromChunks(question, chunks, conversationHistory);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    return {
      ...result,
      responseTime: responseTime
    };
  } catch (error) {
    console.error('❌ RAG pipeline error:', error.message);
    
    // Return fallback response on error
    return {
      answer: getFallbackResponse(),
      chunks: [],
      usedFallback: true,
      error: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

/**
 * Health check for RAG system
 * @returns {Promise<Object>} System status
 */
async function healthCheck() {
  const status = {
    openai: false,
    chromadb: false,
    collection: false
  };

  try {
    // Check OpenAI
    await openai.models.list();
    status.openai = true;
  } catch (error) {
    console.error('OpenAI health check failed:', error.message);
  }

  try {
    // Check local vector store
    const count = await getCount();
    status.chromadb = true;
    status.collection = count > 0;
    status.documentCount = count;
  } catch (error) {
    console.error('Vector store health check failed:', error.message);
  }

  return status;
}

module.exports = {
  embedText,
  retrieveRelevant,
  generateAnswer,
  generateAnswerFromChunks,
  initializeCollection,
  healthCheck
};

