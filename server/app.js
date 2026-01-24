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

const { generateAnswer, generateAnswerStream, healthCheck } = require('./rag');
const { initializeFirebase, logQuery, logEvent } = require('./firebase');
const { CLINIC_NAME } = require('./prompt');
const { requireAuth, optionalAuth, createUser, updateUserRole, getUserByEmail } = require('./auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"], // Allow jspdf and inline scripts
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Allow fonts
      fontSrc: ["'self'", "https://fonts.gstatic.com"], // Allow fonts
      connectSrc: ["'self'", "http://localhost:3000", "https://pnvgpt.onrender.com", "https://refractivegpt.vercel.app", "https://cdnjs.cloudflare.com"]
    }
  }
})); // Security headers

// Configure CORS to allow requests from Vercel frontend and localhost
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or browser favicon requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow all Vercel domains (production and preview deployments)
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow the Render domain itself (for health checks, etc.)
    if (origin.includes('pnvgpt.onrender.com') || origin.includes('onrender.com')) {
      return callback(null, true);
    }
    
    // Allow the specific production domain
    if (origin === 'https://refractivegpt.vercel.app') {
      return callback(null, true);
    }
    
    // Log rejected origins for debugging (but don't block - be permissive)
    console.log(`⚠️  CORS: Allowing origin: ${origin}`);
    callback(null, true);
  },
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
 * Root endpoint - API info (frontend is hosted on Vercel)
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Parkhurst NuVision GPT API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      status: '/status',
      ask: 'POST /ask',
      askStream: 'POST /ask/stream',
      lead: 'POST /lead',
      logEvent: 'POST /log-event'
    },
    frontend: 'https://refractivegpt.vercel.app'
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
      conversationHistory = messages.slice(0, -1).slice(-20); // Keep last 20 messages for context (excluding current)
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

    // Log to Firebase (async, don't wait) - enhanced with buying intent
    logQuery({
      question: sanitizedQuery,
      answer: result.answer,
      retrievedChunks: result.chunks || [],
      timestamp: Date.now(),
      metadata: {
        responseTime: result.responseTime,
        usedFallback: result.usedFallback,
        tokensUsed: result.tokensUsed,
        model: result.model,
        buyingIntent: result.buyingIntent || null,
        questionCount: conversationHistory.filter(m => m.role === 'user').length + 1
      }
    }).catch(err => {
      console.error('Failed to log query:', err.message);
    });

    // Return response with buying intent for frontend CTA decisions
    const responseTime = Date.now() - startTime;
    
    res.json({
      answer: result.answer,
      suggestions: result.suggestions || null, // Include smart suggestions for fallback responses
      metadata: {
        responseTime: responseTime,
        retrievedChunks: result.chunks ? result.chunks.length : 0,
        usedFallback: result.usedFallback || false,
        timestamp: Date.now(),
        debugInfo: result.debugInfo || null, // Include similarity scores and chunk details
        buyingIntent: result.buyingIntent || null, // Include buying intent for frontend CTAs
        showSavingsCalculator: result.showSavingsCalculator || false // Include flag for savings calculator UI
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
 * POST /ask/stream - Streaming FAQ endpoint (typing effect)
 * 
 * Body: { messages: [...] } or { query: "user question" }
 * Response: Server-Sent Events stream
 */
app.post('/ask/stream', async (req, res) => {
  try {
    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Parse request
    const { query, messages } = req.body;
    
    let sanitizedQuery;
    let conversationHistory = [];
    
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage.content || typeof lastMessage.content !== 'string') {
        res.write(`data: ${JSON.stringify({ type: 'error', content: 'Invalid message format' })}\n\n`);
        res.end();
        return;
      }
      sanitizedQuery = lastMessage.content.trim().substring(0, 500);
      conversationHistory = messages.slice(0, -1).slice(-10);
    } else if (query) {
      if (typeof query !== 'string' || query.trim().length === 0) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: 'Query required' })}\n\n`);
        res.end();
        return;
      }
      sanitizedQuery = query.trim().substring(0, 500);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Query or messages required' })}\n\n`);
      res.end();
      return;
    }

    console.log(`💬 [Stream] Question: "${sanitizedQuery}"`);

    // Stream the response
    const generator = generateAnswerStream(sanitizedQuery, conversationHistory);
    
    for await (const chunk of generator) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.end();
    console.log(`✅ [Stream] Response completed`);

  } catch (error) {
    console.error('❌ Stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', content: 'An error occurred' })}\n\n`);
    res.end();
  }
});

/**
 * GET /health - System health check
 */
app.get('/health', async (req, res) => {
  try {
    const status = await healthCheck();
    
    const isHealthy = status.openai && status.vectorStore && status.collection;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      components: {
        openai: status.openai,
        vectorStore: status.vectorStore,
        vectorProvider: status.vectorProvider || 'local',
        collection: status.collection,
        documentCount: status.documentCount || 0
      },
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
 * POST /lead - Lead capture endpoint
 * 
 * Body: { name?, email?, phone?, procedure?, notes?, conversationSummary? }
 * Response: { success: true, leadId: "..." }
 */
app.post('/lead', async (req, res) => {
  try {
    const { name, email, phone, procedure, notes, conversationSummary, source } = req.body;
    
    // Validate - at least one contact method required
    if (!email && !phone) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Please provide at least an email or phone number'
      });
    }
    
    // Create lead object
    const lead = {
      name: name || 'Not provided',
      email: email || null,
      phone: phone || null,
      procedure: procedure || 'Not specified',
      notes: notes || null,
      conversationSummary: conversationSummary || null,
      source: source || 'chatbot',
      createdAt: new Date().toISOString(),
      status: 'new'
    };
    
    // Log to Firebase
    const leadId = await logEvent('lead_capture', 'New lead from chatbot', lead);
    
    console.log(`🎯 New lead captured: ${email || phone} (${procedure || 'general'})`);
    
    res.json({
      success: true,
      leadId: leadId || 'logged',
      message: 'Thank you! Our team will reach out to you shortly.'
    });
    
  } catch (error) {
    console.error('❌ Error capturing lead:', error);
    res.status(500).json({
      error: 'Failed to submit',
      message: 'Please try again or call us directly at (210) 585-2020'
    });
  }
});

/**
 * POST /analytics/event - Track frontend events
 * 
 * Body: { event, data }
 */
app.post('/log-event', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (!event) {
      return res.status(400).json({ error: 'Event name required' });
    }
    
    // Log to Firebase
    await logEvent('frontend_event', event, {
      ...data,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Error logging event:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

/**
 * Future Feature Placeholders
 * These are scaffolded but not implemented
 */

/**
 * POST /auth/login - User login
 * Note: This endpoint returns instructions. Actual login should be done client-side with Supabase.
 * For server-side login, use Supabase Admin API or client SDK.
 */
app.post('/auth/login', async (req, res) => {
  res.json({
    message: 'Please use Supabase client SDK for login',
    instructions: 'Use @supabase/supabase-js on the client side, or implement server-side login with Supabase Admin API',
    clientSideExample: `
      import { createClient } from '@supabase/supabase-js';
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'user@example.com',
        password: 'password'
      });
    `
  });
});

/**
 * POST /auth/register - Create new user (admin only)
 */
app.post('/auth/register', requireAuth(['admin']), async (req, res) => {
  try {
    const { email, password, role = 'user', fullName = '' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Email and password are required'
      });
    }

    const user = await createUser(email, password, role, fullName);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Failed to create user',
      message: error.message
    });
  }
});

/**
 * GET /auth/me - Get current user info
 */
app.get('/auth/me', optionalAuth(), (req, res) => {
  if (req.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } else {
    res.json({
      authenticated: false,
      message: 'No authentication token provided'
    });
  }
});

/**
 * GET /admin/dashboard - Admin dashboard data (protected)
 */
app.get('/admin/dashboard', requireAuth(['admin']), async (req, res) => {
  try {
    // Get analytics data (you can expand this)
    const { getQueryLogs } = require('./firebase');
    
    // Get recent logs (last 100 queries)
    let recentQueries = [];
    try {
      recentQueries = await getQueryLogs({ limit: 100 });
    } catch (err) {
      console.warn('Could not fetch Firebase logs:', err.message);
    }

    res.json({
      success: true,
      data: {
        totalQueries: recentQueries.length,
        recentQueries: recentQueries.slice(0, 10), // Last 10
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
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



