/**
 * Hard Checks Module for Clinician Coaching
 * 
 * Performs deterministic checks against transcripts:
 * - Must-say phrases (coverage check)
 * - Must-not-say phrases (safety check)
 * 
 * IMPORTANT: This module is for CLINICIAN coaching only.
 * It must NEVER import from patient prompts, content, or RAG modules.
 */

/**
 * Parse checklist markdown into an array of phrases
 * Extracts meaningful phrases, ignoring headings, bullets, and blank lines
 * 
 * @param {string} markdown - Raw markdown content
 * @returns {string[]} - Array of phrases to check
 */
function parseChecklistPhrases(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const phrases = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    let cleaned = line.trim();
    
    // Skip empty lines
    if (!cleaned) continue;
    
    // Skip markdown headings (# ## ### etc.)
    if (/^#+\s/.test(cleaned)) continue;
    
    // Skip horizontal rules
    if (/^[-*_]{3,}$/.test(cleaned)) continue;
    
    // Skip metadata lines (bold key-value pairs at top)
    if (/^\*\*[^*]+:\*\*/.test(cleaned)) continue;
    
    // Remove checkbox markers [ ] or [x]
    cleaned = cleaned.replace(/^\[[ x]\]\s*/i, '');
    
    // Remove bullet markers (-, *, •)
    cleaned = cleaned.replace(/^[-*•]\s*/, '');
    
    // Remove numbered list markers (1., 2., etc.)
    cleaned = cleaned.replace(/^\d+\.\s*/, '');
    
    // Skip if it's just a section divider or too short
    if (cleaned.length < 5) continue;
    
    // Skip lines that are just formatting or instructions
    if (cleaned.startsWith('---')) continue;
    if (cleaned.toLowerCase().startsWith('purpose:')) continue;
    
    // Remove quotes if present (we want the actual phrase)
    cleaned = cleaned.replace(/^["']|["']$/g, '');
    
    // Add the cleaned phrase
    if (cleaned.length >= 5) {
      phrases.push(cleaned);
    }
  }

  return phrases;
}

/**
 * Check if transcript contains a phrase (case-insensitive, flexible matching)
 * 
 * @param {string} transcript - The full transcript text
 * @param {string} phrase - The phrase to search for
 * @returns {boolean} - True if phrase (or significant part) is found
 */
function phraseFoundInTranscript(transcript, phrase) {
  const lowerTranscript = transcript.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();
  
  // Direct match
  if (lowerTranscript.includes(lowerPhrase)) {
    return true;
  }
  
  // For longer phrases, check if key words are present together
  // This handles paraphrasing to some degree
  if (phrase.length > 30) {
    const keyWords = lowerPhrase
      .split(/\s+/)
      .filter(word => word.length > 4) // Only significant words
      .filter(word => !['about', 'would', 'could', 'should', 'their', 'there', 'these', 'those', 'which', 'where', 'when'].includes(word));
    
    // If at least 60% of key words are present, consider it a match
    if (keyWords.length >= 3) {
      const foundCount = keyWords.filter(word => lowerTranscript.includes(word)).length;
      return foundCount / keyWords.length >= 0.6;
    }
  }
  
  return false;
}

/**
 * Run deterministic hard checks against a transcript
 * 
 * @param {Object} params - Check parameters
 * @param {string} params.transcript - The consultation transcript
 * @param {string} params.mustSayText - Raw markdown of must-say checklist
 * @param {string} params.mustNotSayText - Raw markdown of must-not-say checklist
 * @returns {Object} - Check results with scores
 */
function runHardChecks({ transcript, mustSayText, mustNotSayText }) {
  // Validate transcript
  if (!transcript || typeof transcript !== 'string') {
    return {
      mustSay: { total: 0, hit: 0, missed: [], hitItems: [] },
      mustNotSay: { total: 0, violated: 0, violations: [] },
      coverageScore: 0,
      safetyScore: 100,
      error: 'No transcript provided'
    };
  }

  // Parse checklists into phrase arrays
  const mustSayPhrases = parseChecklistPhrases(mustSayText);
  const mustNotSayPhrases = parseChecklistPhrases(mustNotSayText);

  // Check must-say phrases
  const hitItems = [];
  const missed = [];
  
  for (const phrase of mustSayPhrases) {
    if (phraseFoundInTranscript(transcript, phrase)) {
      hitItems.push(phrase);
    } else {
      missed.push(phrase);
    }
  }

  // Check must-not-say phrases (violations)
  const violations = [];
  
  for (const phrase of mustNotSayPhrases) {
    if (phraseFoundInTranscript(transcript, phrase)) {
      violations.push(phrase);
    }
  }

  // Calculate scores
  const total = mustSayPhrases.length;
  const hit = hitItems.length;
  const violated = violations.length;

  // Coverage score: percentage of must-say items covered
  const coverageScore = total > 0 ? Math.round(100 * hit / total) : 0;
  
  // Safety score: starts at 100, subtract 25 per violation
  const safetyScore = Math.max(0, 100 - violated * 25);

  return {
    mustSay: {
      total,
      hit,
      missed,
      hitItems
    },
    mustNotSay: {
      total: mustNotSayPhrases.length,
      violated,
      violations
    },
    coverageScore,
    safetyScore
  };
}

module.exports = {
  runHardChecks,
  parseChecklistPhrases,
  phraseFoundInTranscript
};
