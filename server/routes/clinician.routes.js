/**
 * Clinician Routes
 * 
 * Routes for the clinician coaching product arm.
 * These routes are mounted on '/api/clinician/' and are role-protected.
 * 
 * IMPORTANT: These routes must NEVER import from patient prompts or patient content.
 * Clinician coaching uses separate:
 *   - Prompts: server/prompts/clinician/*
 *   - Content: /content_coaching/*
 * 
 * Endpoints:
 * - POST /transcribe - Transcribe consult audio via Whisper
 * - POST /analyze - Analyze transcript against coaching rubrics
 * - POST /coach - Combined: transcribe + analyze in one call
 * 
 * Authentication:
 * - All routes require a valid Supabase JWT token
 * - User must have role 'clinician' or 'admin' in user_profiles table
 * - 401 returned if no/invalid token
 * - 403 returned if authenticated but role not allowed
 * 
 * To set a user as clinician for testing:
 * 1. Via admin endpoint (requires admin token):
 *    POST /auth/register with { email, password, role: 'clinician' }
 * 2. Via Supabase dashboard:
 *    Update user_profiles table, set role = 'clinician' for the user
 * 3. Via script:
 *    node scripts/create-test-user.js (modify to use role 'clinician')
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();

const { getSupabase } = require('../supabase');
const { requireAuth } = require('../auth');
const { transcribeAudioBuffer, checkConfiguration: checkWhisperConfig } = require('../services/whisperService');
const { listRubrics, loadRubric, listChecklists, loadChecklist, checkDirectories } = require('../coach/rubricLoader');
const { analyzeTranscript, checkConfiguration: checkCoachConfig } = require('../services/clinicianCoachService');

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

/**
 * Configure multer for audio file uploads
 * - Uses memory storage (no disk writes)
 * - 50MB limit for longer recordings
 * - Single file upload with field name "audio"
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept common audio formats
    const allowedMimes = [
      'audio/webm',
      'audio/mp3',
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/m4a',
      'audio/mp4',
      'audio/ogg',
      'audio/flac'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Use mp3, wav, webm, m4a, ogg, or flac.`), false);
    }
  }
});

/**
 * Multer error handler middleware
 */
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large',
        message: 'Audio file exceeds 50MB limit. Please use a shorter recording.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Only one audio file allowed per request.'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Upload error',
      message: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file',
      message: err.message
    });
  }
  next();
}

// ============================================================================
// ROLE PROTECTION
// ============================================================================

/**
 * Apply role protection to ALL clinician routes.
 * Only users with 'clinician' or 'admin' role can access these endpoints.
 * 
 * Response codes:
 * - 401 Unauthorized: Missing or invalid JWT token
 * - 403 Forbidden: Valid token but user role is not clinician/admin
 */
router.use(requireAuth(['clinician', 'admin']));

// ============================================================================
// TRANSCRIPTION ENDPOINT
// ============================================================================

/**
 * POST /transcribe - Transcribe consult audio
 * 
 * Accepts audio file and returns text transcript using OpenAI Whisper.
 * 
 * Request:
 *   Content-Type: multipart/form-data
 *   Field: audio (required) - Audio file (mp3, wav, webm, m4a, ogg, flac)
 * 
 * Response (success):
 *   {
 *     success: true,
 *     transcript: "...",
 *     meta: { filename, size, mimetype }
 *   }
 * 
 * Response (error):
 *   { success: false, error: "..." }
 * 
 * Status codes:
 *   200 - Success
 *   400 - No file or invalid format
 *   401 - Not authenticated
 *   403 - Not authorized (wrong role)
 *   413 - File too large
 *   500 - Server/API error
 */
router.post('/transcribe', upload.single('audio'), handleMulterError, async (req, res) => {
  try {
    // Check configuration first
    const config = checkWhisperConfig();
    if (!config.configured) {
      console.error('❌ Whisper service not configured:', config.error);
      return res.status(500).json({
        success: false,
        error: 'Transcription service not configured',
        message: config.error
      });
    }

    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
        message: 'Please upload an audio file with field name "audio"'
      });
    }

    console.log(`🎤 [Clinician ${req.user.email}] Transcription request: ${req.file.originalname} (${req.file.size} bytes)`);

    // Call Whisper service
    const result = await transcribeAudioBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Return successful transcription
    res.json({
      success: true,
      transcript: result.transcript,
      meta: {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

  } catch (error) {
    console.error('❌ Transcription endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Transcription failed',
      message: error.message
    });
  }
});

// ============================================================================
// COMBINED COACH ENDPOINT (TRANSCRIBE + ANALYZE)
// ============================================================================

/**
 * POST /coach - Combined transcription and coaching analysis
 * 
 * Single endpoint that transcribes audio and runs coaching analysis.
 * Useful for one-call workflow and better auditability.
 * 
 * Request:
 *   Content-Type: multipart/form-data
 *   Fields:
 *     - audio (required): Audio file (mp3, wav, webm, m4a, ogg, flac)
 *     - rubricId (optional): Specific rubric ID to use (auto-detected if not provided)
 * 
 * Response (success):
 *   {
 *     success: true,
 *     transcript: string,
 *     analysis: {
 *       rubricId: string,
 *       rubricTitle: string,
 *       hardChecks: {...},
 *       llmFeedback: {...},
 *       score: { coverageScore, safetyScore, overall }
 *     },
 *     meta: { filename, size, mimetype, transcriptionTime, analysisTime }
 *   }
 * 
 * Response (error):
 *   { success: false, error: string, step?: "transcription"|"analysis" }
 * 
 * Status codes:
 *   200 - Success
 *   400 - No file or invalid format
 *   401 - Not authenticated
 *   403 - Not authorized (wrong role)
 *   413 - File too large
 *   500 - Transcription or analysis failed
 * 
 * -------------------------------------------------------------------------
 * CURL EXAMPLE:
 * -------------------------------------------------------------------------
 * 
 * curl -X POST http://localhost:3000/api/clinician/coach \
 *   -H "Authorization: Bearer YOUR_CLINICIAN_TOKEN" \
 *   -F "audio=@/path/to/consultation.webm" \
 *   -F "rubricId=surgeon_consult_v1"
 * 
 * # Response includes both transcript and full coaching analysis
 * -------------------------------------------------------------------------
 */
router.post('/coach', upload.single('audio'), handleMulterError, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check both services are configured
    const whisperConfig = checkWhisperConfig();
    if (!whisperConfig.configured) {
      console.error('❌ Whisper service not configured:', whisperConfig.error);
      return res.status(500).json({
        success: false,
        error: 'Transcription service not configured',
        message: whisperConfig.error
      });
    }

    const coachConfig = checkCoachConfig();
    if (!coachConfig.configured) {
      console.error('❌ Coach service not configured:', coachConfig.error);
      return res.status(500).json({
        success: false,
        error: 'Coaching service not configured',
        message: coachConfig.error
      });
    }

    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
        message: 'Please upload an audio file with field name "audio"'
      });
    }

    // Get optional rubricId from form data
    const rubricId = req.body.rubricId || null;

    console.log(`🎯 [Clinician ${req.user.email}] Coach request: ${req.file.originalname} (${req.file.size} bytes, rubric: ${rubricId || 'auto'})`);

    // Step 1: Transcribe audio
    const transcriptionStart = Date.now();
    console.log('📝 Step 1: Transcribing audio...');
    
    const transcriptionResult = await transcribeAudioBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype
    });

    if (!transcriptionResult.success) {
      console.error('❌ Transcription failed:', transcriptionResult.error);
      return res.status(500).json({
        success: false,
        error: transcriptionResult.error,
        step: 'transcription'
      });
    }

    const transcriptionTime = Date.now() - transcriptionStart;
    console.log(`✅ Transcription complete (${transcriptionTime}ms, ${transcriptionResult.transcript.length} chars)`);

    // Step 2: Analyze transcript
    const analysisStart = Date.now();
    console.log('📊 Step 2: Analyzing transcript...');
    
    const analysisResult = await analyzeTranscript({
      transcript: transcriptionResult.transcript,
      rubricId
    });

    if (!analysisResult.success) {
      console.error('❌ Analysis failed:', analysisResult.error);
      return res.status(500).json({
        success: false,
        error: analysisResult.error,
        step: 'analysis',
        transcript: transcriptionResult.transcript // Include transcript even if analysis failed
      });
    }

    const analysisTime = Date.now() - analysisStart;
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ Analysis complete (${analysisTime}ms) - Total: ${totalTime}ms, Score: ${analysisResult.score.overall}/100`);

    // Save to database if user is authenticated
    if (req.user && req.user.id) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { error: saveError } = await supabase
            .from('coaching_sessions')
            .insert({
              user_id: req.user.id,
              transcript: transcriptionResult.transcript,
              analysis_result: analysisResult,
              rubric_id: analysisResult.rubricId,
              score_overall: analysisResult.score.overall,
              score_coverage: analysisResult.score.coverageScore,
              score_safety: analysisResult.score.safetyScore,
              metadata: {
                source: 'coach_endpoint',
                filename: req.file.originalname,
                transcriptionTime,
                analysisTime,
                totalTime
              }
            });
          
          if (saveError) {
            console.error('⚠️ Failed to save coaching session:', saveError);
          } else {
            console.log('💾 Coaching session saved to database');
          }
        }
      } catch (dbError) {
        console.error('⚠️ Database error saving coaching session:', dbError);
      }
    }

    // Return combined result
    res.json({
      success: true,
      transcript: transcriptionResult.transcript,
      analysis: analysisResult,
      meta: {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        transcriptionTime,
        analysisTime,
        totalTime
      }
    });

  } catch (error) {
    console.error('❌ Coach endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Coaching failed',
      message: error.message
    });
  }
});

// ============================================================================
// ANALYSIS ENDPOINT
// ============================================================================

/**
 * POST /analyze - Analyze transcript against coaching rubrics
 * 
 * Takes a transcript and runs it through:
 * 1. Deterministic hard checks (must-say/must-not-say)
 * 2. LLM-powered coaching feedback
 * 
 * Request:
 *   Content-Type: application/json
 *   Body: { 
 *     transcript: string (required, min 50 chars),
 *     rubricId?: string (optional, auto-detected if not provided)
 *   }
 * 
 * Response (success):
 *   {
 *     success: true,
 *     result: {
 *       rubricId: string,
 *       rubricTitle: string,
 *       hardChecks: {
 *         mustSay: { total, hit, missed, hitItems },
 *         mustNotSay: { total, violated, violations },
 *         coverageScore: number,
 *         safetyScore: number
 *       },
 *       llmFeedback: {
 *         summary: string,
 *         roleDetected: "surgeon"|"counselor"|"unknown",
 *         strengths: string[],
 *         improvements: string[],
 *         missedItems: string[],
 *         redFlags: string[],
 *         suggestedPhrases: [{ situation, rewrite }],
 *         nextCallPlan: string[]
 *       },
 *       score: {
 *         coverageScore: number,
 *         safetyScore: number,
 *         overall: number
 *       }
 *     }
 *   }
 * 
 * Response (error):
 *   { success: false, error: string }
 * 
 * Status codes:
 *   200 - Success
 *   400 - Missing/invalid transcript
 *   401 - Not authenticated
 *   403 - Not authorized (wrong role)
 *   500 - Server/API error
 * 
 * -------------------------------------------------------------------------
 * CURL EXAMPLES:
 * -------------------------------------------------------------------------
 * 
 * # Analyze with auto-detected rubric:
 * curl -X POST http://localhost:3000/api/clinician/analyze \
 *   -H "Authorization: Bearer YOUR_CLINICIAN_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "transcript": "Hi Mrs. Johnson, I am Dr. Smith. Based on your exam, you are a great candidate for LASIK. The procedure takes about 15 minutes per eye. Common side effects include dry eye and halos at night, but these typically improve over 3-6 months. Do you have any questions?"
 *   }'
 * 
 * # Analyze with specific rubric:
 * curl -X POST http://localhost:3000/api/clinician/analyze \
 *   -H "Authorization: Bearer YOUR_CLINICIAN_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "transcript": "...",
 *     "rubricId": "surgeon_consult_v1"
 *   }'
 * 
 * # Expected response keys:
 * # - success: boolean
 * # - result.rubricId: which rubric was used
 * # - result.hardChecks: deterministic check results
 * # - result.llmFeedback: AI-generated coaching feedback
 * # - result.score: overall scores (0-100)
 * -------------------------------------------------------------------------
 */
router.post('/analyze', async (req, res) => {
  try {
    // Check configuration first
    const config = checkCoachConfig();
    if (!config.configured) {
      console.error('❌ Coach service not configured:', config.error);
      return res.status(500).json({
        success: false,
        error: 'Coaching service not configured',
        message: config.error
      });
    }

    // Validate request body
    const { transcript, rubricId } = req.body;

    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required',
        message: 'Please provide a transcript in the request body'
      });
    }

    if (typeof transcript !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid transcript',
        message: 'Transcript must be a string'
      });
    }

    if (transcript.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Transcript too short',
        message: 'Transcript must be at least 10 characters'
      });
    }

    console.log(`📊 [Clinician ${req.user.email}] Analysis request (${transcript.length} chars, rubric: ${rubricId || 'auto'})`);

    // Run analysis
    const result = await analyzeTranscript({ transcript, rubricId });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Return successful analysis
    console.log(`✅ Analysis complete - Score: ${result.score.overall}/100`);
    
    // Save to database if user is authenticated
    if (req.user && req.user.id) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { error: saveError } = await supabase
            .from('coaching_sessions')
            .insert({
              user_id: req.user.id,
              transcript: transcript,
              analysis_result: result,
              rubric_id: result.rubricId,
              score_overall: result.score.overall,
              score_coverage: result.score.coverageScore,
              score_safety: result.score.safetyScore,
              metadata: {
                source: 'analyze_endpoint',
                charCount: transcript.length
              }
            });
          
          if (saveError) {
            console.error('⚠️ Failed to save coaching session:', saveError);
          } else {
            console.log('💾 Coaching session saved to database');
          }
        }
      } catch (dbError) {
        console.error('⚠️ Database error saving coaching session:', dbError);
      }
    }
    
    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('❌ Analysis endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: error.message
    });
  }
});

// ============================================================================
// RUBRICS ENDPOINTS
// ============================================================================

/**
 * GET /rubrics - List available coaching rubrics
 * 
 * Returns all rubrics from content_coaching/rubrics with metadata.
 * 
 * Response:
 *   {
 *     success: true,
 *     rubrics: [
 *       { id, title, version, lastUpdated, appliesTo, filename }
 *     ],
 *     checklists: [
 *       { id, title, filename }
 *     ]
 *   }
 */
router.get('/rubrics', async (req, res) => {
  try {
    // Check directories exist
    const dirs = checkDirectories();
    if (!dirs.rubricsDir) {
      return res.status(500).json({
        success: false,
        error: 'Rubrics directory not found',
        message: 'content_coaching/rubrics directory does not exist'
      });
    }

    const rubrics = await listRubrics();
    const checklists = await listChecklists();

    res.json({
      success: true,
      rubrics,
      checklists,
      count: {
        rubrics: rubrics.length,
        checklists: checklists.length
      }
    });

  } catch (error) {
    console.error('❌ Error listing rubrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list rubrics',
      message: error.message
    });
  }
});

/**
 * GET /rubrics/:id - Get a specific rubric by ID
 * 
 * Response:
 *   {
 *     success: true,
 *     rubric: { id, metadata, content, sections, sectionCount }
 *   }
 */
router.get('/rubrics/:id', async (req, res) => {
  try {
    const rubricId = req.params.id;
    const rubric = await loadRubric(rubricId);

    if (!rubric) {
      return res.status(404).json({
        success: false,
        error: 'Rubric not found',
        message: `No rubric found with id: ${rubricId}`
      });
    }

    res.json({
      success: true,
      rubric
    });

  } catch (error) {
    console.error(`❌ Error loading rubric ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to load rubric',
      message: error.message
    });
  }
});

/**
 * GET /checklists/:id - Get a specific checklist by ID
 * 
 * Response:
 *   {
 *     success: true,
 *     checklist: { id, title, content }
 *   }
 */
router.get('/checklists/:id', async (req, res) => {
  try {
    const checklistId = req.params.id;
    const checklist = await loadChecklist(checklistId);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found',
        message: `No checklist found with id: ${checklistId}`
      });
    }

    res.json({
      success: true,
      checklist
    });

  } catch (error) {
    console.error(`❌ Error loading checklist ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to load checklist',
      message: error.message
    });
  }
});

// ============================================================================
// HISTORY ENDPOINT (NOT YET IMPLEMENTED)
// ============================================================================

/**
 * GET /history - Get clinician's past analyses (future)
 * 
 * Status: NOT IMPLEMENTED
 */
router.get('/history', async (req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Analysis history feature is under development',
    endpoint: '/api/clinician/history'
  });
});

module.exports = router;
