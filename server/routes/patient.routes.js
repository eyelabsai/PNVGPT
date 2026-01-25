/**
 * Patient Routes
 * 
 * All patient-facing endpoints for the FAQ chatbot.
 * These routes are mounted on both '/' (backward compatibility) and '/api/patient/'.
 * 
 * Endpoints:
 * - POST /ask - Main FAQ endpoint
 * - POST /ask/stream - Streaming FAQ endpoint
 * - POST /lead - Lead capture
 * - POST /log-event - Analytics event logging
 * - GET /health - System health check
 * - GET /status - Simple status check
 */

const express = require('express');
const router = express.Router();

const { generateAnswer, generateAnswerStream, healthCheck } = require('../rag');
const { logQuery, logEvent } = require('../firebase');

/**
 * POST /ask - Main FAQ endpoint
 * 
 * Body: { query: "user question" } or { messages: [...] }
 * Response: { answer: "...", metadata: {...} }
 */
router.post('/ask', async (req, res) => {
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
router.post('/ask/stream', async (req, res) => {
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
 * POST /lead - Lead capture endpoint
 * 
 * Body: { name?, email?, phone?, procedure?, notes?, conversationSummary? }
 * Response: { success: true, leadId: "..." }
 */
router.post('/lead', async (req, res) => {
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
 * POST /log-event - Track frontend events
 * 
 * Body: { event, data }
 */
router.post('/log-event', async (req, res) => {
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
 * GET /health - System health check
 */
router.get('/health', async (req, res) => {
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
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
