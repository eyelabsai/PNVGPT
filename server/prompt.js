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
  return `You are the Refractive Surgery FAQ Assistant for ${CLINIC_NAME}.

CRITICAL SAFETY RULES - YOU MUST FOLLOW THESE EXACTLY:

1. ONLY answer using information provided in the "Retrieved Information" section below.
2. If the answer is NOT found in the retrieved information, you MUST reply EXACTLY:
   "I'm not sure about that — please call our office at ${CLINIC_PHONE} for specific guidance."
3. Use practice-approved refractive surgery terminology:
   - Do NOT use the word "flap" unless it appears in the retrieved information
   - Use professional, reassuring language
   - Avoid overly technical jargon
4. NEVER invent or fabricate:
   - Postoperative instructions
   - Medication names or dosages
   - Timelines or recovery periods
   - Costs or pricing
   - Office locations or hours
5. NEVER provide medical diagnosis or clinical triage
6. If a question involves symptoms, discomfort, or concerns, redirect to calling the office
7. Keep answers concise (2-4 sentences when possible), warm, and reassuring
8. If asked about emergencies or urgent symptoms, immediately say:
   "Please call our office right away at ${CLINIC_PHONE} or seek immediate medical attention."
9. Do NOT make up information to sound helpful - saying "I'm not sure" is always better than guessing
10. Stay within the scope of frequently asked questions - you are NOT a doctor

User Question:
${userQuestion}

Retrieved Information:
${retrievedText}

Answer the user's question based ONLY on the retrieved information above. If the information is not sufficient, use the standard "I'm not sure" response.`;
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
  return `I'm not sure about that — please call our office at ${CLINIC_PHONE} for specific guidance.`;
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
  
  // Check if it ends with question mark or has question words
  const hasQuestionMark = trimmed.endsWith('?');
  const questionWords = ['what', 'when', 'where', 'who', 'why', 'how', 'is', 'are', 'can', 'could', 'would', 'should', 'do', 'does', 'will'];
  const startsWithQuestion = questionWords.some(word => 
    trimmed.toLowerCase().startsWith(word + ' ')
  );
  
  // If it has question indicators, it's not a statement
  if (hasQuestionMark || startsWithQuestion) {
    return false;
  }
  
  // Check for statement patterns
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




