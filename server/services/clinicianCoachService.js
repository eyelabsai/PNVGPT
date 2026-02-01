/**
 * Clinician Coach Service
 * 
 * Orchestrates the analysis of clinician consultation transcripts:
 * 1. Load appropriate rubric and checklists
 * 2. Run deterministic hard checks
 * 3. Call LLM for detailed coaching feedback
 * 4. Combine and return results
 * 
 * IMPORTANT: This service is for CLINICIAN coaching only.
 * It must NEVER import from:
 *   - Patient prompts (server/prompt.js, server/prompts/patient/*)
 *   - Patient content (/content/*)
 *   - Patient RAG system (server/rag.js)
 */

const { FormData, fetch } = require('undici');
require('dotenv').config();

const { loadRubric, loadChecklist } = require('../coach/rubricLoader');
const { runHardChecks } = require('../coach/hardChecks');
const { buildCoachMessages } = require('../prompts/clinician/buildCoachMessages');

// Model configuration - matches patient-side for consistency
const GPT_MODEL = process.env.CLINICIAN_COACH_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * Detect the most appropriate rubric based on transcript content
 * 
 * @param {string} transcript - The consultation transcript
 * @returns {string} - Rubric ID to use
 */
function detectRubric(transcript) {
  // Single rubric applies to all refractive/cataract counselor consultations
  return 'refractive_counselor_v2';
}

/**
 * Call OpenAI API for coaching analysis
 * 
 * @param {Array} messages - Messages array for chat completion
 * @returns {Promise<Object>} - Parsed LLM response
 */
async function callOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }

  console.log(`🤖 Calling OpenAI (${GPT_MODEL}) for coaching analysis...`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GPT_MODEL,
      messages,
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 2000,
      response_format: { type: 'json_object' } // Force JSON output
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ OpenAI API error: ${response.status}`, errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response structure from OpenAI');
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage
  };
}

/**
 * Parse LLM response safely, with fallback for parse errors
 * 
 * @param {string} content - Raw LLM response content
 * @returns {Object} - Parsed feedback object
 */
function parseLLMResponse(content) {
  try {
    const parsed = JSON.parse(content);
    
    // Validate required fields exist
    const requiredFields = ['summary', 'strengths', 'improvements'];
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        parsed[field] = field === 'summary' 
          ? 'Analysis completed but some fields were missing.' 
          : [];
      }
    }
    
    // Ensure arrays are actually arrays
    const arrayFields = ['strengths', 'improvements', 'missedItems', 'redFlags', 'suggestedPhrases', 'nextCallPlan'];
    for (const field of arrayFields) {
      if (!Array.isArray(parsed[field])) {
        parsed[field] = [];
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('❌ Failed to parse LLM response:', error.message);
    console.error('Raw content:', content.substring(0, 500));
    
    // Return fallback structure
    return {
      summary: `Analysis completed but response parsing failed: ${error.message}. Raw response may contain useful feedback.`,
      roleDetected: 'unknown',
      strengths: [],
      improvements: ['Review the transcript manually for coaching opportunities'],
      missedItems: [],
      redFlags: [],
      suggestedPhrases: [],
      nextCallPlan: ['Schedule follow-up review'],
      _parseError: true,
      _rawContent: content.substring(0, 1000)
    };
  }
}

/**
 * Analyze a clinician consultation transcript
 * 
 * @param {Object} params - Analysis parameters
 * @param {string} params.transcript - The consultation transcript
 * @param {string} [params.rubricId] - Optional rubric ID (auto-detected if not provided)
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeTranscript({ transcript, rubricId }) {
  // Validate transcript
  if (!transcript || typeof transcript !== 'string') {
    return {
      success: false,
      error: 'Transcript is required'
    };
  }

  if (transcript.trim().length < 50) {
    return {
      success: false,
      error: 'Transcript too short (minimum 50 characters)'
    };
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
    };
  }

  try {
    // Determine rubric to use
    const selectedRubricId = rubricId || detectRubric(transcript);
    console.log(`📋 Using rubric: ${selectedRubricId}`);

    // Load rubric
    const rubric = await loadRubric(selectedRubricId);
    if (!rubric) {
      return {
        success: false,
        error: `Rubric not found: ${selectedRubricId}`
      };
    }

    // Load checklists
    const mustSay = await loadChecklist('must_say');
    const mustNotSay = await loadChecklist('must_not_say');

    if (!mustSay || !mustNotSay) {
      console.warn('⚠️ One or more checklists not found, proceeding with empty checklists');
    }

    // Run hard checks
    console.log('🔍 Running hard checks...');
    const hardChecks = runHardChecks({
      transcript,
      mustSayText: mustSay?.content || '',
      mustNotSayText: mustNotSay?.content || ''
    });
    console.log(`   Coverage: ${hardChecks.coverageScore}%, Safety: ${hardChecks.safetyScore}%`);

    // Build messages for LLM
    const messages = buildCoachMessages({
      transcript,
      rubricMd: rubric.content,
      mustSayMd: mustSay?.content || '',
      mustNotSayMd: mustNotSay?.content || '',
      hardChecks,
      rubricId: selectedRubricId
    });

    // Call LLM
    const llmResponse = await callOpenAI(messages);
    console.log(`✅ LLM response received (${llmResponse.usage?.total_tokens || 'unknown'} tokens)`);

    // Parse LLM response
    const llmFeedback = parseLLMResponse(llmResponse.content);

    // Calculate overall score
    const overallScore = Math.round(
      hardChecks.coverageScore * 0.7 + hardChecks.safetyScore * 0.3
    );

    return {
      success: true,
      rubricId: selectedRubricId,
      rubricTitle: rubric.metadata.title,
      hardChecks,
      llmFeedback,
      score: {
        coverageScore: hardChecks.coverageScore,
        safetyScore: hardChecks.safetyScore,
        overall: overallScore
      },
      meta: {
        model: GPT_MODEL,
        tokensUsed: llmResponse.usage?.total_tokens || null
      }
    };

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return {
      success: false,
      error: `Analysis failed: ${error.message}`
    };
  }
}

/**
 * Check if the coaching service is properly configured
 * @returns {Object} - { configured: boolean, error?: string }
 */
function checkConfiguration() {
  if (!process.env.OPENAI_API_KEY) {
    return {
      configured: false,
      error: 'OPENAI_API_KEY environment variable not set'
    };
  }
  return { 
    configured: true,
    model: GPT_MODEL
  };
}

module.exports = {
  analyzeTranscript,
  checkConfiguration,
  detectRubric
};
