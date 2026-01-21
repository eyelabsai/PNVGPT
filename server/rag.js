/**
 * RAG (Retrieval-Augmented Generation) Logic
 * 
 * Handles:
 * - Text embedding with OpenAI
 * - Vector search with ChromaDB
 * - Answer generation with GPT-4o-mini
 */

const { OpenAI } = require('openai');
// Use Supabase vector store if configured, otherwise fall back to local
const { querySimilar, getCount, healthCheck: vectorHealthCheck } = require('./vectorstore-supabase');
const { generatePrompt, getFallbackResponse, hasRelevantInformation, isGreeting, getGreetingResponse, isAffirmative, getSchedulingResponse, isObjection, getObjectionResponse, isStatement, getConversationalPrompt } = require('./prompt');
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
const COUNSELING_THRESHOLD = 0.20; // Lower threshold for counseling/emotional concerns

// Buying intent signals for conversion tracking
const BUYING_SIGNALS = [
  'ready', 'schedule', 'book', 'appointment', 'consultation',
  'how do i get started', 'next step', 'sign up', 'qualify',
  'interested', 'want to do this', 'how soon', 'available',
  'cost', 'price', 'financing', 'payment', 'afford',
  'candidate', 'good candidate', 'am i eligible',
  'where are you', 'location', 'address', 'directions'
];

const PROCEDURE_KEYWORDS = {
  lasik: ['lasik', 'laser eye surgery', 'laser vision'],
  prk: ['prk', 'photorefractive'],
  smile: ['smile', 'lalex', 'small incision'],
  icl: ['icl', 'evo', 'implantable lens', 'implantable contact'],
  cataract: ['cataract', 'cloudy lens', 'lens replacement'],
  rle: ['rle', 'refractive lens exchange', 'lens replacement']
};

/**
 * Detect buying intent in user query
 * @param {string} query - User's question
 * @returns {Object} Intent analysis
 */
function detectBuyingIntent(query) {
  const lowerQuery = query.toLowerCase();
  
  const signals = BUYING_SIGNALS.filter(signal => lowerQuery.includes(signal));
  const hasBuyingIntent = signals.length > 0;
  
  // Detect which procedures are mentioned
  const proceduresMentioned = [];
  for (const [procedure, keywords] of Object.entries(PROCEDURE_KEYWORDS)) {
    if (keywords.some(kw => lowerQuery.includes(kw))) {
      proceduresMentioned.push(procedure);
    }
  }
  
  // High intent signals
  const highIntentSignals = ['schedule', 'book', 'appointment', 'ready', 'sign up', 'get started'];
  const isHighIntent = highIntentSignals.some(signal => lowerQuery.includes(signal));
  
  return {
    hasBuyingIntent,
    isHighIntent,
    signals,
    proceduresMentioned,
    intentScore: signals.length + (isHighIntent ? 2 : 0)
  };
}

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
 * Detect if a query is asking for comparison between procedures
 * @param {string} query - User's question
 * @returns {Array|null} Array of [procedure1, procedure2] or null if not a comparison
 */
function detectComparisonQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // Comparison keywords
  const comparisonKeywords = [
    'better', 'worse', 'compare', 'comparison', 'versus', 'vs', 'vs.', 
    'difference', 'different', 'or', 'between'
  ];
  
  const hasComparisonKeyword = comparisonKeywords.some(keyword => 
    lowerQuery.includes(keyword)
  );
  
  if (!hasComparisonKeyword) {
    return null;
  }
  
  // Procedure names to detect
  const procedures = [
    { names: ['lasik'], canonical: 'LASIK' },
    { names: ['prk'], canonical: 'PRK' },
    { names: ['smile', 'lalex'], canonical: 'SMILE' },
    { names: ['icl', 'evo'], canonical: 'ICL' },
    { names: ['cataract'], canonical: 'cataract surgery' }
  ];
  
  // Find which procedures are mentioned
  const mentionedProcedures = [];
  for (const proc of procedures) {
    if (proc.names.some(name => lowerQuery.includes(name))) {
      mentionedProcedures.push(proc.canonical);
    }
  }
  
  // Return if we found exactly 2 procedures to compare
  if (mentionedProcedures.length === 2) {
    return mentionedProcedures;
  }
  
  return null;
}

/**
 * Enhance vague queries using conversation history
 * @param {string} query - User's question
 * @param {Array} conversationHistory - Previous messages
 * @returns {Promise<string>} Enhanced query with context
 */
async function enhanceQueryWithContext(query, conversationHistory = []) {
  // Skip enhancement if query is already detailed (>8 words) or no history
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount > 8 || !conversationHistory || conversationHistory.length === 0) {
    return query;
  }

  // Check for vague follow-up patterns
  const vaguePatterns = [
    /^(what|how) about/i,
    /compared to/i,
    /versus/i,
    /vs\.?/i,
    /difference/i,
    /\b(it|this|that|those|these)\b/i,
    // Follow-up affirmations + questions
    /^(yes|yeah|yep|sure|ok|okay|alright)[\s,]+(how|what|when|where|why|can|will|do|does|is|are)/i,
    // Very short queries that need context
    /^(how|what|when|where|why|can|will|is|are)\??$/i
  ];

  const isVague = vaguePatterns.some(pattern => pattern.test(query));
  if (!isVague) {
    return query;
  }

  try {
    // Get recent conversation context (last 3 exchanges)
    const recentHistory = conversationHistory.slice(-6).map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');

    const prompt = `The user is having a conversation and just asked: "${query}"

Recent conversation:
${recentHistory}

Rewrite their question to be more specific and self-contained for search, incorporating BOTH the topic/aspect AND the entities from the conversation context. Preserve what aspect is being discussed (cost, safety, recovery, etc.).

Examples:
- After discussing LASIK cost, "what about EVO" → "How much does EVO ICL cost compared to LASIK?"
- After discussing LASIK safety, "what about SMILE" → "Is SMILE safe compared to LASIK?"
- "is it safe?" → "Is LASIK safe?"
- "how much does this cost" → "How much does LASIK cost?"
- After discussing recovery, "what about PRK" → "What is PRK recovery like compared to LASIK?"

Output ONLY the rewritten question, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You rewrite vague follow-up questions into clear, self-contained search queries. You preserve BOTH the topic/aspect (cost, safety, recovery) AND entities (procedures) from conversation context.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 60
    });

    const enhancedQuery = completion.choices[0].message.content.trim();
    console.log(`🔍 Enhanced query: "${query}" → "${enhancedQuery}"`);
    return enhancedQuery;
  } catch (error) {
    console.error('❌ Error enhancing query:', error.message);
    return query; // Fall back to original query on error
  }
}

/**
 * Retrieve chunks for a single query
 * @param {string} searchQuery - Search query string
 * @returns {Promise<Array>} Array of chunks with similarity scores
 */
async function searchChunks(searchQuery) {
  const queryEmbedding = await embedText(searchQuery);
  const results = await querySimilar(queryEmbedding, TOP_K_RESULTS);
  
  const chunks = [];
  if (results.documents && results.documents[0]) {
    for (let i = 0; i < results.documents[0].length; i++) {
      const metadata = results.metadatas[0][i];
      const distance = results.distances[0][i];
      const similarity = 1 - distance;

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
  
  return chunks;
}

/**
 * Retrieve most relevant chunks from vector database
 * @param {string} query - User's question
 * @param {Array} conversationHistory - Previous messages for context enhancement
 * @returns {Promise<Array>} Array of relevant chunks with metadata
 */
async function retrieveRelevant(query, conversationHistory = []) {
  try {
    // Ensure vector store is initialized
    if (!initialized) {
      await initializeCollection();
    }

    // Enhance query with conversation context if needed
    const enhancedQuery = await enhanceQueryWithContext(query, conversationHistory);
    
    // Check if this is a comparison query
    const comparisonProcedures = detectComparisonQuery(enhancedQuery);
    
    let chunks = [];
    let allResults = [];
    
    if (comparisonProcedures) {
      // For comparison queries, search for each procedure separately and combine results
      console.log(`🔄 Detected comparison: ${comparisonProcedures.join(' vs ')}`);
      
      const [proc1, proc2] = comparisonProcedures;
      const chunks1 = await searchChunks(`${proc1} procedure benefits features characteristics`);
      const chunks2 = await searchChunks(`${proc2} procedure benefits features characteristics`);
      
      // Combine and deduplicate chunks
      const seenIds = new Set();
      const combinedChunks = [...chunks1, ...chunks2].filter(chunk => {
        if (seenIds.has(chunk.id)) {
          return false;
        }
        seenIds.add(chunk.id);
        return true;
      });
      
      // Sort by similarity and take top results
      chunks = combinedChunks
        .sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity))
        .slice(0, TOP_K_RESULTS);
      
      allResults = chunks.map(c => ({
        filename: c.filename,
        chunkId: c.chunkId,
        similarity: parseFloat(c.similarity),
        passedThreshold: true
      }));
      
      console.log(`📚 Retrieved ${chunks.length} chunks for comparison (${chunks1.length} + ${chunks2.length})`);
    } else {
      // Normal single query search
      const queryEmbedding = await embedText(enhancedQuery);
      const results = await querySimilar(queryEmbedding, TOP_K_RESULTS);

      if (results.documents && results.documents[0]) {
        // Check if this is an emotional/financial concern query (check both original and enhanced query)
        const lowerQuery = query.toLowerCase();
        const isEmotionalQuery = lowerQuery.includes('nervous') || lowerQuery.includes('worried') || 
                                 lowerQuery.includes('scared') || lowerQuery.includes('afraid') || 
                                 lowerQuery.includes('anxious') || lowerQuery.includes('fear') ||
                                 lowerQuery.includes('responding to fear'); // Check for enhanced query keywords
        const isFinancialQuery = lowerQuery.includes('expensive') || lowerQuery.includes('too much') || 
                                 lowerQuery.includes('afford') || lowerQuery.includes('cost too much') ||
                                 lowerQuery.includes('responding to financial'); // Check for enhanced query keywords
        const isCounselingQuery = isEmotionalQuery || isFinancialQuery;
        
        console.log(`🔍 Query analysis: emotional=${isEmotionalQuery}, financial=${isFinancialQuery}, counseling=${isCounselingQuery}`);
        
        for (let i = 0; i < results.documents[0].length; i++) {
          const metadata = results.metadatas[0][i];
          const distance = results.distances[0][i];
          const similarity = 1 - distance;
          
          // Use lower threshold for counseling strategies content or counseling-related queries
          const isCounselingContent = metadata.filename && metadata.filename.includes('counseling');
          const effectiveThreshold = (isCounselingContent || isCounselingQuery) ? COUNSELING_THRESHOLD : SIMILARITY_THRESHOLD;

          const chunkInfo = {
            filename: metadata.filename || 'unknown',
            chunkId: metadata.chunkId || '',
            similarity: parseFloat(similarity.toFixed(4)),
            passedThreshold: similarity >= effectiveThreshold,
            effectiveThreshold: effectiveThreshold
          };

          allResults.push(chunkInfo);

          if (similarity >= effectiveThreshold) {
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
    }
    
    // Return both chunks and debug info
    return {
      chunks: chunks,
      debugInfo: {
        allResults: allResults,
        threshold: SIMILARITY_THRESHOLD,
        topK: TOP_K_RESULTS,
        enhancedQuery: enhancedQuery !== query ? enhancedQuery : null,
        isComparison: !!comparisonProcedures
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
        content: 'You are a warm, friendly, and knowledgeable assistant for a refractive surgery practice. Your goal is to make patients feel comfortable and informed. Answer questions conversationally and naturally, like you\'re chatting with a friend who needs guidance. Use the provided FAQ information from the database, but present it in an engaging, human way. Use conversation history to understand context and pronouns. Be reassuring and encouraging while staying accurate to the provided information.'
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
      temperature: 0.6, // Slightly higher for more natural, conversational responses
      max_tokens: 400, // Allow longer, more complete responses
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
        responseTime: Date.now() - startTime,
        buyingIntent: detectBuyingIntent(question)
      };
    }

    // Check if it's an affirmative response (yes, sure, ok) - likely responding to scheduling question
    // This is a HIGH INTENT signal - give them clear scheduling next steps!
    if (isAffirmative(question)) {
      const schedulingResponse = getSchedulingResponse();
      return {
        answer: schedulingResponse,
        chunks: [],
        usedFallback: false,
        isAffirmative: true,
        responseTime: Date.now() - startTime,
        buyingIntent: {
          hasBuyingIntent: true,
          isHighIntent: true,
          signals: ['affirmative_response'],
          proceduresMentioned: [],
          intentScore: 5 // Highest intent!
        }
      };
    }

    // Check if it's an objection (no, not sure, scared, too expensive)
    // This is where we employ counseling strategies to address concerns
    if (isObjection(question)) {
      const objectionResponse = getObjectionResponse(question);
      return {
        answer: objectionResponse,
        chunks: [],
        usedFallback: false,
        isObjection: true,
        responseTime: Date.now() - startTime,
        buyingIntent: {
          hasBuyingIntent: true, // They're still engaged!
          isHighIntent: false,
          signals: ['objection_response'],
          proceduresMentioned: [],
          intentScore: 2 // Medium intent - they have concerns but are still talking
        }
      };
    }

    // Check if it's a statement (not a question) - but first try RAG for emotional/financial concerns
    const lowerQuestion = question.toLowerCase();
    const isEmotionalConcern = lowerQuestion.includes('nervous') || lowerQuestion.includes('worried') || 
                               lowerQuestion.includes('scared') || lowerQuestion.includes('afraid') || 
                               lowerQuestion.includes('anxious') || lowerQuestion.includes('fear');
    const isFinancialConcern = lowerQuestion.includes('expensive') || lowerQuestion.includes('too much') || 
                               lowerQuestion.includes('afford') || lowerQuestion.includes('cost too much');
    
    // For emotional or financial concerns, try RAG first to get counseling strategies
    if (isStatement(question) && !isEmotionalConcern && !isFinancialConcern) {
      const conversationalResponse = await handleConversationalMode(question, conversationHistory);
      return {
        answer: conversationalResponse,
        chunks: [],
        usedFallback: false,
        isConversational: true,
        responseTime: Date.now() - startTime,
        buyingIntent: detectBuyingIntent(question)
      };
    }
    
    // For emotional/financial concerns, enhance the query to find counseling strategies
    let searchQuery = question;
    if (isEmotionalConcern) {
      searchQuery = question + ' responding to fear nervousness concerns reassurance';
    } else if (isFinancialConcern) {
      searchQuery = question + ' responding to financial concerns expensive cost affordability';
    }

    // Retrieve relevant chunks (use enhanced query for emotional/financial concerns)
    const retrievalResult = await retrieveRelevant(searchQuery || question, conversationHistory);
    const chunks = retrievalResult.chunks;
    const debugInfo = retrievalResult.debugInfo;

    // Detect buying intent for analytics and CTA suggestions
    const buyingIntent = detectBuyingIntent(question);
    
    // Generate answer with conversation context
    const result = await generateAnswerFromChunks(question, chunks, conversationHistory);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    return {
      ...result,
      responseTime: responseTime,
      debugInfo: debugInfo, // Include similarity scores and chunk details
      buyingIntent: buyingIntent // Include buying intent for frontend CTAs
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
    vectorStore: false,
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
    // Check vector store (Supabase or local)
    const vectorStatus = await vectorHealthCheck();
    status.vectorStore = vectorStatus.connected;
    status.vectorProvider = vectorStatus.provider;
    status.collection = vectorStatus.documentCount > 0;
    status.documentCount = vectorStatus.documentCount;
  } catch (error) {
    console.error('Vector store health check failed:', error.message);
  }

  // Legacy field for backwards compatibility
  status.chromadb = status.vectorStore;

  return status;
}

/**
 * Generate streaming answer using GPT-4o-mini
 * Yields chunks of text as they're generated
 * @param {string} question - User's question
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {AsyncGenerator} Yields text chunks
 */
async function* generateAnswerStream(question, conversationHistory = []) {
  const startTime = Date.now();

  try {
    // Validate input
    if (!question || question.trim().length === 0) {
      yield { type: 'error', content: 'Question cannot be empty' };
      return;
    }

    // Check if it's a greeting - respond immediately (no streaming needed)
    if (isGreeting(question)) {
      const greetingResponse = getGreetingResponse(question);
      yield { type: 'content', content: greetingResponse };
      yield { type: 'done', responseTime: Date.now() - startTime };
      return;
    }

    // Check if it's an affirmative response (yes, sure, ok) - give scheduling next steps
    if (isAffirmative(question)) {
      const schedulingResponse = getSchedulingResponse();
      yield { type: 'content', content: schedulingResponse };
      yield { type: 'done', responseTime: Date.now() - startTime, isAffirmative: true };
      return;
    }

    // Check if it's an objection (no, not sure, scared, too expensive) - address concerns
    if (isObjection(question)) {
      const objectionResponse = getObjectionResponse(question);
      yield { type: 'content', content: objectionResponse };
      yield { type: 'done', responseTime: Date.now() - startTime, isObjection: true };
      return;
    }

    // Check if it's a statement - use conversational mode
    // But first check for emotional/financial concerns that should use RAG
    const lowerQuestion = question.toLowerCase();
    const isEmotionalConcern = lowerQuestion.includes('nervous') || lowerQuestion.includes('worried') || 
                               lowerQuestion.includes('scared') || lowerQuestion.includes('afraid');
    const isFinancialConcern = lowerQuestion.includes('expensive') || lowerQuestion.includes('too much') || 
                               lowerQuestion.includes('afford');
    
    if (isStatement(question) && !isEmotionalConcern && !isFinancialConcern) {
      const conversationalResponse = await handleConversationalMode(question, conversationHistory);
      yield { type: 'content', content: conversationalResponse };
      yield { type: 'done', responseTime: Date.now() - startTime };
      return;
    }

    // Retrieve relevant chunks
    const retrievalResult = await retrieveRelevant(question, conversationHistory);
    const chunks = retrievalResult.chunks;

    // If no relevant chunks, return fallback
    if (!chunks || chunks.length === 0) {
      yield { type: 'content', content: getFallbackResponse() };
      yield { type: 'done', usedFallback: true, responseTime: Date.now() - startTime };
      return;
    }

    // Combine chunk texts
    const retrievedText = chunks
      .map((chunk, idx) => `[Source ${idx + 1}: ${chunk.filename}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    // Check if we have relevant information
    if (!hasRelevantInformation(retrievedText)) {
      yield { type: 'content', content: getFallbackResponse() };
      yield { type: 'done', usedFallback: true, responseTime: Date.now() - startTime };
      return;
    }

    // Generate prompt with safety rules
    const fullPrompt = generatePrompt(question, retrievedText);

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: 'You are a warm, friendly, and knowledgeable assistant for a refractive surgery practice. Your goal is to make patients feel comfortable and informed. Answer questions conversationally and naturally, like you\'re chatting with a friend who needs guidance. Use the provided FAQ information from the database, but present it in an engaging, human way. Use conversation history to understand context and pronouns. Be reassuring and encouraging while staying accurate to the provided information.'
      }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-5).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    messages.push({ role: 'user', content: fullPrompt });

    // Call OpenAI with streaming
    const stream = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: messages,
      temperature: 0.6, // More natural, conversational responses
      max_tokens: 400, // Allow longer, more complete responses
      stream: true // Enable streaming!
    });

    // Yield each chunk as it arrives
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { type: 'content', content: content };
      }
    }

    // Signal completion
    yield { 
      type: 'done', 
      chunks: chunks.length,
      responseTime: Date.now() - startTime 
    };

  } catch (error) {
    console.error('❌ Streaming error:', error.message);
    yield { type: 'error', content: getFallbackResponse() };
  }
}

module.exports = {
  embedText,
  retrieveRelevant,
  generateAnswer,
  generateAnswerFromChunks,
  generateAnswerStream,
  initializeCollection,
  healthCheck
};

