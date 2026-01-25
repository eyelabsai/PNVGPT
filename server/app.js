/**
 * Express Server for RAG-based FAQ Assistant
 * 
 * Provides API endpoints for:
 * - Patient FAQ chatbot (via RAG)
 * - Clinician coaching tools (under development)
 * - Health checks
 * - Admin dashboard
 * 
 * Route Structure:
 * - /api/patient/* - Patient-facing endpoints
 * - /api/clinician/* - Clinician coaching endpoints (role-protected)
 * - Legacy routes (/, /ask, etc.) - Backward compatible, forward to patient routes
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { initializeFirebase } = require('./firebase');
const { CLINIC_NAME } = require('./prompt');
const { requireAuth, optionalAuth, createUser, updateUserRole, getUserByEmail } = require('./auth');

// Import route modules
const patientRoutes = require('./routes/patient.routes');
const clinicianRoutes = require('./routes/clinician.routes');

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

// ============================================================================
// ROUTE MOUNTING
// ============================================================================

/**
 * Mount Patient Routes
 * 
 * Patient routes are mounted on BOTH:
 * - '/api/patient' - New canonical path
 * - '/' - Legacy path for backward compatibility
 * 
 * This ensures existing frontend calling /ask continues to work while
 * new code can use /api/patient/ask.
 */
app.use('/api/patient', patientRoutes);
app.use('/', patientRoutes);  // Backward compatibility - keep /ask, /health, etc. working

/**
 * Mount Clinician Routes
 * 
 * Clinician routes are only mounted on '/api/clinician'.
 * These will be role-protected when implemented.
 */
app.use('/api/clinician', clinicianRoutes);

// ============================================================================
// ROOT ENDPOINT
// ============================================================================

/**
 * Root endpoint - API info (frontend is hosted on Vercel)
 * Note: This is defined AFTER patient routes so /ask, /health, etc. still work
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Parkhurst NuVision GPT API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      // Legacy endpoints (backward compatible)
      health: '/health',
      status: '/status',
      ask: 'POST /ask',
      askStream: 'POST /ask/stream',
      lead: 'POST /lead',
      logEvent: 'POST /log-event',
      // New API structure
      patientApi: '/api/patient/*',
      clinicianApi: '/api/clinician/*'
    },
    frontend: 'https://refractivegpt.vercel.app'
  });
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

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

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

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

// ============================================================================
// FUTURE FEATURE PLACEHOLDERS
// ============================================================================

/**
 * POST /ask/voice - Voice mode with Whisper (future)
 * Note: This is patient-facing voice. Clinician transcription is at /api/clinician/transcribe
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

// ============================================================================
// ERROR HANDLING
// ============================================================================

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

// ============================================================================
// SERVER STARTUP
// ============================================================================

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
      console.log(`   Patient API:    /api/patient/*`);
      console.log(`   Clinician API:  /api/clinician/*`);
      console.log(`   Legacy:         /ask, /health (backward compatible)`);
      console.log(`\n📍 Example routes:`);
      console.log(`   http://localhost:${PORT}/`);
      console.log(`   http://localhost:${PORT}/ask`);
      console.log(`   http://localhost:${PORT}/api/patient/ask`);
      console.log(`   http://localhost:${PORT}/api/clinician/transcribe`);
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
