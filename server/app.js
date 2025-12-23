/**
 * Express Server for RAG-based FAQ Assistant
 * 
 * Provides API endpoints for:
 * - Answering user questions via RAG
 * - Health checks
 * - Future: Admin dashboard, analytics
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { generateAnswer, healthCheck } = require('./rag');
const { initializeFirebase, logQuery, logEvent } = require('./firebase');
const { CLINIC_NAME } = require('./prompt');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers

// Configure CORS to allow requests from Vercel frontend
const corsOptions = {
  origin: [
    'https://refractivegpt.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions)); // Enable CORS for frontend integration

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * Root endpoint - API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Parkhurst NuVision GPT API',
    version: '1.0.0',
    clinic: CLINIC_NAME,
    endpoints: {
      '/ask': 'POST - Ask a question',
      '/health': 'GET - System health check',
      '/status': 'GET - API status'
    },
    documentation: 'See README.md for usage instructions'
  });
});

/**
 * POST /ask - Main FAQ endpoint
 * 
 * Body: { query: "user question" }
 * Response: { answer: "...", metadata: {...} }
 */
app.post('/ask', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate request - support both old (query) and new (messages) format
    const { query, messages } = req.body;
    
    let sanitizedQuery;
    let conversationHistory = [];
    
    if (messages && Array.isArray(messages) && messages.length > 0) {
      // New format: messages array like ChatGPT
      // Get the last user message as the query
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.content || typeof lastMessage.content !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Last message must have content'
        });
      }
      sanitizedQuery = lastMessage.content.trim().substring(0, 500);
      conversationHistory = messages.slice(0, -1).slice(-10); // Keep last 10 messages for context (excluding current)
    } else if (query) {
      // Old format: single query string (backwards compatible)
      if (typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Query parameter is required and must be a non-empty string'
        });
      }
      sanitizedQuery = query.trim().substring(0, 500);
    } else {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Either query or messages parameter is required'
      });
    }
    
    console.log(`💬 Question: "${sanitizedQuery}"${conversationHistory.length > 0 ? ` (with ${conversationHistory.length} messages of context)` : ''}`);

    // Generate answer using RAG pipeline with conversation context
    const result = await generateAnswer(sanitizedQuery, conversationHistory);

    // Log to Firebase (async, don't wait)
    logQuery({
      question: sanitizedQuery,
      answer: result.answer,
      retrievedChunks: result.chunks || [],
      timestamp: Date.now(),
      metadata: {
        responseTime: result.responseTime,
        usedFallback: result.usedFallback,
        tokensUsed: result.tokensUsed,
        model: result.model
      }
    }).catch(err => {
      console.error('Failed to log query:', err.message);
    });

    // Return response
    const responseTime = Date.now() - startTime;
    
    res.json({
      answer: result.answer,
      suggestions: result.suggestions || null, // Include smart suggestions for fallback responses
      metadata: {
        responseTime: responseTime,
        retrievedChunks: result.chunks ? result.chunks.length : 0,
        usedFallback: result.usedFallback || false,
        timestamp: Date.now(),
        debugInfo: result.debugInfo || null // Include similarity scores and chunk details
      }
    });

    console.log(`✅ Response sent (${responseTime}ms)`);

  } catch (error) {
    console.error('❌ Error processing request:', error);
    
    // Log error to Firebase
    logEvent('error', 'Request processing failed', {
      error: error.message,
      path: req.path,
      method: req.method
    }).catch(err => console.error('Failed to log error:', err.message));

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your question. Please try again or call our office.'
    });
  }
});

/**
 * GET /health - System health check
 */
app.get('/health', async (req, res) => {
  try {
    const status = await healthCheck();
    
    const isHealthy = status.openai && status.chromadb && status.collection;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      components: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /status - Simple status check
 */
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Future Feature Placeholders
 * These are scaffolded but not implemented
 */

/**
 * POST /auth/login - Admin authentication (future)
 */
app.post('/auth/login', (req, res) => {
  res.status(501).json({
    message: 'Authentication feature coming soon',
    implemented: false
  });
});

/**
 * GET /admin/dashboard - Admin dashboard data (future)
 */
app.get('/admin/dashboard', (req, res) => {
  res.status(501).json({
    message: 'Admin dashboard feature coming soon',
    implemented: false
  });
});

/**
 * POST /admin/content - Update FAQ content via UI (future)
 */
app.post('/admin/content', (req, res) => {
  res.status(501).json({
    message: 'Content management feature coming soon',
    implemented: false
  });
});

/**
 * POST /ask/voice - Voice mode with Whisper (future)
 */
app.post('/ask/voice', (req, res) => {
  res.status(501).json({
    message: 'Voice mode feature coming soon',
    implemented: false
  });
});

/**
 * POST /ask/translate - Multilingual support (future)
 */
app.post('/ask/translate', (req, res) => {
  res.status(501).json({
    message: 'Translation feature coming soon',
    implemented: false
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.path} not found`
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

/**
 * Start server
 */
async function startServer() {
  try {
    console.log('\n🚀 Starting PNVGPT FAQ Assistant Server...\n');
    console.log('='.repeat(50));
    
    // Initialize Firebase
    console.log('🔥 Initializing Firebase...');
    initializeFirebase();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`\n📍 API Endpoints:`);
      console.log(`   http://localhost:${PORT}/`);
      console.log(`   http://localhost:${PORT}/ask`);
      console.log(`   http://localhost:${PORT}/health`);
      console.log(`\n💡 Test with:`);
      console.log(`   curl -X POST http://localhost:${PORT}/ask \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{"query": "What is LASIK?"}'`);
      console.log('\n' + '='.repeat(50) + '\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = app;



