/**
 * Safety Prompt Template for Refractive Surgery FAQ Assistant
 * 
 * This module generates the system prompt that enforces strict safety rules
 * to prevent hallucinations and ensure patient safety.
 */

require('dotenv').config();

const CLINIC_PHONE = process.env.CLINIC_PHONE || 'XXX-XXX-XXXX';
const CLINIC_NAME = process.env.CLINIC_NAME || 'our clinic';

/**
 * Generates the complete prompt with safety rules and retrieved context
 * @param {string} userQuestion - The question asked by the user
 * @param {string} retrievedText - The relevant text chunks retrieved from the vector database
 * @returns {string} The complete prompt for the LLM
 */
function generatePrompt(userQuestion, retrievedText) {
  return `You are a friendly, conversational assistant for ${CLINIC_NAME} helping patients understand their refractive surgery procedures.

YOUR APPROACH:
- Be warm, natural, and conversational - like talking to a friend who needs guidance
- Use the information provided below, but present it in an engaging, human way
- Show empathy and understanding - patients may be nervous or uncertain
- Break down complex medical info into easy-to-understand explanations
- Be encouraging and reassuring while staying accurate

SAFETY RULES (CRITICAL):

1. ONLY use information from the "Retrieved Information" section below. If the answer isn't there, say:
   "I'm not sure about that specific detail. Could you rephrase your question, or feel free to call our office at ${CLINIC_PHONE} for personalized guidance?"

2. Language style:
   - Use conversational, friendly language (avoid robotic responses)
   - Keep technical jargon minimal - explain things simply
   - Use "you" and "your" to keep it personal
   - Don't use "flap" unless it's in the retrieved info

3. Costs and pricing:
   - Share cost information naturally if it's in the retrieved info
   - Mention financing options (HSA/FSA) if included
   - Present ranges conversationally ("typically costs around..." or "usually between...")

4. NEVER make up:
   - Specific instructions, medication names, timelines, costs, or office details
   - Medical diagnoses or clinical advice

5. For symptoms or concerns, warmly redirect:
   "I'd recommend calling our office at ${CLINIC_PHONE} to discuss that - they can give you personalized guidance."

6. For emergencies, respond immediately:
   "Please call our office right away at ${CLINIC_PHONE} or seek immediate medical attention."

7. Comparisons:
   - Use facts from the retrieved info to explain differences naturally
   - Avoid saying one is definitively "better"
   - Mention that the best choice depends on individual factors

8. Length: Aim for 3-5 sentences unless the question needs more detail. Be thorough but conversational.

User Question:
${userQuestion}

Retrieved Information:
${retrievedText}

Now answer their question conversationally using the information above. Make them feel heard and informed!`;
}

/**
 * Generates a system message for conversation context
 * @returns {string} System message
 */
function getSystemMessage() {
  return `You are a helpful FAQ assistant for ${CLINIC_NAME}. You provide accurate information based solely on the practice's approved content. You never invent information and always direct patients to call the office when you're unsure.`;
}

/**
 * Validates if retrieved text contains sufficient information
 * @param {string} retrievedText - The retrieved text chunks
 * @returns {boolean} True if text seems relevant
 */
function hasRelevantInformation(retrievedText) {
  // Basic validation - if retrieved text is too short, it's likely not relevant
  return retrievedText && retrievedText.trim().length > 50;
}

/**
 * Generates the fallback response when no information is found
 * @returns {string} The fallback message
 */
function getFallbackResponse() {
  return `I'm not sure about that. Could you try rephrasing your question more specifically? Or feel free to call our office at ${CLINIC_PHONE} for personalized guidance.`;
}

/**
 * Detects if a query is a greeting or small talk
 * @param {string} query - User's query
 * @returns {boolean} True if it's a greeting
 */
function isGreeting(query) {
  const lowerQuery = query.toLowerCase().trim();
  const greetings = [
    'hi', 'hello', 'hey', 'howdy', 'greetings',
    'good morning', 'good afternoon', 'good evening',
    'how are you', 'what\'s up', 'whats up',
    'thanks', 'thank you', 'bye', 'goodbye'
  ];
  
  return greetings.some(greeting => lowerQuery === greeting || lowerQuery.startsWith(greeting + ' ') || lowerQuery.startsWith(greeting + '!'));
}

/**
 * Detects if a query is a statement (not a question)
 * Statements should get conversational guidance, not RAG answers
 * @param {string} query - User's query
 * @returns {boolean} True if it's a statement
 */
function isStatement(query) {
  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();
  
  // Check if it ends with question mark or has question words ANYWHERE
  const hasQuestionMark = trimmed.endsWith('?');
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how'];
  const hasQuestionWord = questionWords.some(word => 
    lowerQuery.includes(' ' + word + ' ') || 
    lowerQuery.startsWith(word + ' ') ||
    lowerQuery.endsWith(' ' + word)
  );
  
  // Check for question structure patterns (e.g., "is it", "can I", "will I")
  const questionPatterns = [
    /\b(is|are|am|was|were)\s+(it|this|that|there|lasik|prk|smile|icl|evo)/i,
    /\b(can|could|should|would|will|do|does)\s+(i|you|we|it|this|that)/i,
    /\bhow\s+(much|long|soon|many)/i
  ];
  const hasQuestionPattern = questionPatterns.some(pattern => pattern.test(lowerQuery));
  
  // If it has question indicators, it's NOT a statement - it's a question
  if (hasQuestionMark || hasQuestionWord || hasQuestionPattern) {
    return false;
  }
  
  // Check for pure statement patterns (without questions embedded)
  const statementPatterns = [
    /^i (am|was|have|had|need|want|got|getting|scheduled|told)/i,
    /^my (doctor|surgeon|eye|vision)/i,
    /^i'm (getting|having|scheduled|nervous|worried|concerned)/i,
    /^the (doctor|surgeon) (said|told|recommended)/i
  ];
  
  return statementPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Generates a natural greeting response
 * @param {string} query - User's greeting
 * @returns {string} Natural greeting response
 */
function getGreetingResponse(query) {
  const lowerQuery = query.toLowerCase().trim();
  
  if (lowerQuery.includes('thank')) {
    return "You're welcome! Is there anything else I can help you with?";
  }
  
  if (lowerQuery.includes('bye') || lowerQuery.includes('goodbye')) {
    return "Have a great day! Feel free to come back anytime if you have more questions.";
  }
  
  // Default friendly greeting
  return "Hello! I'm here to answer your questions about refractive surgery procedures like LASIK, PRK, recovery, costs, and more. What would you like to know?";
}

/**
 * Generates a conversational prompt for statements/context
 * Uses GPT to understand context and guide users naturally
 * @param {string} statement - User's statement
 * @param {Array} conversationHistory - Previous messages
 * @returns {string} System prompt for conversational mode
 */
function getConversationalPrompt(statement, conversationHistory) {
  return `You are a friendly, helpful assistant for ${CLINIC_NAME}, a refractive surgery practice.

The user just made a statement or shared context (not a direct question): "${statement}"

Your job is to:
1. Acknowledge their statement warmly
2. Understand what they might need help with
3. Guide them to ask specific questions about procedures, recovery, costs, or concerns
4. Be conversational and supportive
5. NEVER provide specific medical advice, costs, or instructions
6. Suggest they ask questions or call the office for specifics

Examples:
- "I was told I need cataract surgery" → "I'd be happy to help! What would you like to know about cataract surgery? I can answer questions about the procedure, recovery, costs, or anything else."
- "I'm nervous about LASIK" → "It's completely normal to feel nervous! Would you like to know what to expect during the procedure, or learn about recovery? I'm here to answer any questions."
- "My doctor said I'm a good candidate" → "That's great news! Do you have any questions about the procedure, what to expect, or next steps?"

Keep responses brief (2-3 sentences) and encouraging. Guide them to ask questions.`;
}

module.exports = {
  generatePrompt,
  getSystemMessage,
  hasRelevantInformation,
  getFallbackResponse,
  isGreeting,
  getGreetingResponse,
  isStatement,
  getConversationalPrompt,
  CLINIC_PHONE,
  CLINIC_NAME
};




