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
const { generatePrompt, getFallbackResponse, hasRelevantInformation, isGreeting, getGreetingResponse, isStatement, getConversationalPrompt } = require('./prompt');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const GPT_MODEL = 'gpt-4o-mini';
const COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || 'faq_collection';
const TOP_K_RESULTS = 5; // Increased from 3 to better find relevant content
const SIMILARITY_THRESHOLD = 0.25; // Lowered from 0.3 to catch more relevant matches

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

    // Parse and format results with full debug info
    const chunks = [];
    const allResults = []; // Track ALL results for debugging
    
    if (results.documents && results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        const metadata = results.metadatas[0][i];
        const distance = results.distances[0][i];
        const similarity = 1 - distance; // Convert distance to similarity

        const chunkInfo = {
          filename: metadata.filename || 'unknown',
          chunkId: metadata.chunkId || '',
          similarity: parseFloat(similarity.toFixed(4)),
          passedThreshold: similarity >= SIMILARITY_THRESHOLD
        };

        // Track all results for debug display
        allResults.push(chunkInfo);

        // Only include chunks above similarity threshold for RAG
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
    
    // Return both chunks and debug info
    return {
      chunks: chunks,
      debugInfo: {
        allResults: allResults,
        threshold: SIMILARITY_THRESHOLD,
        topK: TOP_K_RESULTS
      }
    };
  } catch (error) {
    console.error('❌ Error retrieving relevant chunks:', error.message);
    throw error;
  }
}

/**
 * Generate smart question suggestions based on retrieved chunks
 * @param {string} vaguQuestion - The vague question user asked
 * @param {Array} chunks - Retrieved chunks that have context
 * @returns {Promise<Array<string>>} Array of 3 suggested questions
 */
async function generateSuggestions(vagueQuestion, chunks) {
  try {
    // If no chunks, return generic suggestions
    if (!chunks || chunks.length === 0) {
      return [
        "Could you be more specific about what you'd like to know?",
        "What procedure are you interested in learning about?",
        "Do you have questions about costs, recovery, or candidacy?"
      ];
    }

    // Combine chunk texts for context
    const contextText = chunks
      .slice(0, 3) // Use top 3 chunks
      .map(chunk => chunk.text)
      .join('\n\n---\n\n');

    const prompt = `A user asked a vague question: "${vagueQuestion}"

Based on the following relevant content from our FAQ database, generate exactly 3 specific questions the user might be trying to ask. Make them natural, clear, and directly answerable from the content.

Content:
${contextText}

Generate 3 questions in this exact format (one per line, no numbering, no extra text):
Question 1
Question 2
Question 3`;

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You generate clear, specific questions based on FAQ content. Output exactly 3 questions, one per line, no numbering or extra text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const response = completion.choices[0].message.content.trim();
    const suggestions = response
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0 && q.endsWith('?'))
      .slice(0, 3); // Ensure exactly 3

    // Fallback if parsing failed
    if (suggestions.length < 3) {
      return [
        "What would you like to know about this procedure?",
        "Are you asking about costs, recovery, or candidacy?",
        "Could you rephrase your question more specifically?"
      ];
    }

    return suggestions;
  } catch (error) {
    console.error('❌ Error generating suggestions:', error.message);
    return [
      "Could you try rephrasing your question?",
      "What specific information are you looking for?",
      "Would you like to know about a specific procedure?"
    ];
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
    // If no relevant chunks found, return fallback with suggestions
    if (!chunks || chunks.length === 0) {
      const suggestions = await generateSuggestions(question, []);
      return {
        answer: getFallbackResponse(),
        chunks: [],
        usedFallback: true,
        suggestions: suggestions
      };
    }

    // Combine chunk texts
    const retrievedText = chunks
      .map((chunk, idx) => `[Source ${idx + 1}: ${chunk.filename}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    // Check if we have relevant information
    if (!hasRelevantInformation(retrievedText)) {
      const suggestions = await generateSuggestions(question, chunks);
      return {
        answer: getFallbackResponse(),
        chunks: chunks,
        usedFallback: true,
        suggestions: suggestions
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

    // Check if GPT returned a fallback response (didn't have enough info to answer)
    const isFallback = answer.includes("I'm not sure about that") || answer.includes("please call our office");
    
    // If it's a fallback, generate suggestions
    let suggestions = null;
    if (isFallback) {
      suggestions = await generateSuggestions(question, chunks);
    }

    return {
      answer: answer,
      chunks: chunks,
      usedFallback: isFallback,
      suggestions: suggestions,
      model: GPT_MODEL,
      tokensUsed: completion.usage.total_tokens
    };
  } catch (error) {
    console.error('❌ Error generating answer:', error.message);
    throw error;
  }
}

/**
 * Handle conversational mode for statements/context
 * Uses GPT to understand and guide users without RAG
 * @param {string} statement - User's statement
 * @param {Array} conversationHistory - Previous messages
 * @returns {Promise<string>} Conversational response
 */
async function handleConversationalMode(statement, conversationHistory = []) {
  try {
    const messages = [
      {
        role: 'system',
        content: getConversationalPrompt(statement, conversationHistory)
      }
    ];

    // Add recent conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-5).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Add current statement
    messages.push({
      role: 'user',
      content: statement
    });

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: messages,
      temperature: 0.7, // Higher temperature for natural conversation
      max_tokens: 150
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Error in conversational mode:', error.message);
    return "I'd be happy to help! What questions do you have about refractive surgery procedures, recovery, or costs?";
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

    // Check if it's a statement (not a question) - use conversational mode
    if (isStatement(question)) {
      const conversationalResponse = await handleConversationalMode(question, conversationHistory);
      return {
        answer: conversationalResponse,
        chunks: [],
        usedFallback: false,
        isConversational: true,
        responseTime: Date.now() - startTime
      };
    }

    // Retrieve relevant chunks for medical questions
    const retrievalResult = await retrieveRelevant(question);
    const chunks = retrievalResult.chunks;
    const debugInfo = retrievalResult.debugInfo;

    // Generate answer with conversation context
    const result = await generateAnswerFromChunks(question, chunks, conversationHistory);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    return {
      ...result,
      responseTime: responseTime,
      debugInfo: debugInfo // Include similarity scores and chunk details
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

