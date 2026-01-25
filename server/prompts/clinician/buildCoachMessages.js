/**
 * Coach Message Builder
 * 
 * Builds the messages array for the OpenAI chat completion API
 * when analyzing clinician consultation transcripts.
 * 
 * IMPORTANT: This module is for CLINICIAN coaching only.
 * It must NEVER import from patient prompts, content, or RAG modules.
 */

const { COACH_SYSTEM_PROMPT } = require('./coachPolicy');

/**
 * Build the messages array for coaching analysis
 * 
 * @param {Object} params - Build parameters
 * @param {string} params.transcript - The consultation transcript
 * @param {string} params.rubricMd - The rubric markdown content
 * @param {string} params.mustSayMd - The must-say checklist markdown
 * @param {string} params.mustNotSayMd - The must-not-say checklist markdown
 * @param {Object} params.hardChecks - Results from deterministic hard checks
 * @param {string} params.rubricId - ID of the rubric being used
 * @returns {Array} - Messages array for OpenAI API
 */
function buildCoachMessages({ transcript, rubricMd, mustSayMd, mustNotSayMd, hardChecks, rubricId }) {
  // Build the hard checks summary for context
  const hardChecksSummary = buildHardChecksSummary(hardChecks);
  
  // Build the user message with all context
  const userMessage = `
## CONSULTATION TRANSCRIPT TO ANALYZE

${transcript}

---

## RUBRIC: ${rubricId}

${rubricMd}

---

## MUST-SAY CHECKLIST

${mustSayMd}

---

## MUST-NOT-SAY CHECKLIST

${mustNotSayMd}

---

## AUTOMATED CHECK RESULTS

${hardChecksSummary}

---

## YOUR TASK

Analyze the transcript above against the rubric and checklists. Provide coaching feedback as a JSON object.

Requirements:
- Give 5-12 specific improvements
- Provide 3-8 suggested phrase rewrites
- Ensure missedItems aligns with the mustSay items that were missed
- Include any mustNotSay violations in redFlags
- Identify any high-pressure, dismissive, or unsafe language as redFlags
- Be constructive and specific

Output ONLY a valid JSON object matching the schema from your instructions. No other text.
`.trim();

  return [
    {
      role: 'system',
      content: COACH_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: userMessage
    }
  ];
}

/**
 * Build a human-readable summary of hard checks for LLM context
 * 
 * @param {Object} hardChecks - Results from runHardChecks()
 * @returns {string} - Formatted summary
 */
function buildHardChecksSummary(hardChecks) {
  if (!hardChecks) {
    return 'No automated checks were run.';
  }

  const lines = [];
  
  // Must-say summary
  lines.push(`### Must-Say Coverage: ${hardChecks.coverageScore}%`);
  lines.push(`- Covered: ${hardChecks.mustSay.hit}/${hardChecks.mustSay.total} items`);
  
  if (hardChecks.mustSay.missed.length > 0) {
    lines.push(`- MISSED ITEMS:`);
    hardChecks.mustSay.missed.slice(0, 10).forEach(item => {
      lines.push(`  • ${item}`);
    });
    if (hardChecks.mustSay.missed.length > 10) {
      lines.push(`  • ... and ${hardChecks.mustSay.missed.length - 10} more`);
    }
  }
  
  lines.push('');
  
  // Must-not-say summary
  lines.push(`### Safety Score: ${hardChecks.safetyScore}%`);
  lines.push(`- Violations found: ${hardChecks.mustNotSay.violated}`);
  
  if (hardChecks.mustNotSay.violations.length > 0) {
    lines.push(`- VIOLATIONS DETECTED:`);
    hardChecks.mustNotSay.violations.forEach(item => {
      lines.push(`  ⚠️ ${item}`);
    });
  }
  
  return lines.join('\n');
}

module.exports = {
  buildCoachMessages,
  buildHardChecksSummary
};
