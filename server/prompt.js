/**
 * Safety Prompt Template for Refractive Surgery FAQ Assistant
 * 
 * This module generates the system prompt that enforces strict safety rules
 * to prevent hallucinations and ensure patient safety.
 */

require('dotenv').config();

const CLINIC_PHONE = process.env.CLINIC_PHONE || '(210) 585-2020';
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

8. FORMATTING FOR READABILITY:
   - Use line breaks (double line break) between paragraphs to break up text
   - Use bullet points (• or -) for lists of procedures, steps, or options
   - Use bold (**text**) sparingly for emphasis on key terms or procedure names
   - Break up long sentences into shorter, digestible chunks
   - Example format:
     "Here are your options:
     
     • **LASIK** - Uses two lasers to reshape the cornea
     • **SMILE** - Single laser procedure, less invasive
     • **EVO ICL** - Implantable lens, reversible if needed
     
     The best way to know which is right for you is a consultation!"

9. Length: Aim for 3-5 sentences unless the question needs more detail. Be thorough but conversational.

10. CONVERSION & NEXT STEPS:
   - **PACING IS KEY**: Do NOT suggest a consultation in every response! That feels pushy.
     * Suggest it ONCE early in the conversation (after the first or second substantive question)
     * Then WAIT at least 4-5 responses before mentioning it again
     * Only bring it up again if they ask about candidacy, pricing, or next steps
   - When you DO suggest it, keep it brief and natural: "If you'd like, you can schedule a consultation to learn more. Call us at ${CLINIC_PHONE} or schedule online!"
   - Make it feel easy and low-pressure: "It takes a little over an hour, and there's no obligation."
   - SAVINGS CALCULATOR NUDGE:
     * If the user is asking about LASIK cost, expensive procedures, or shows hesitation about the investment, you can say:
       "By the way, if you share your age and how often you typically buy new glasses or contacts, I can help you calculate how much you could save over the long run with vision correction!"

11. GROUND RULES & SPECIFIC KNOWLEDGE (CRITICAL):
    
    **TONE & CONTEXT:**
    - **NO "BIG DEAL" LANGUAGE**: NEVER call these procedures "big decisions" or make them sound scary/intimidating. Keep it casual and positive!
    - **STAY ON TOPIC**: Remember what procedure the user is asking about. If they're talking about LASIK, don't randomly bring up other procedures. Stay focused on their topic of interest.
    - **NO "FREE"**: NEVER call the consultation "free." Just call it a "consultation."
    - **POSITIVE LANGUAGE**: NEVER use the word "reduce" when talking about the need for glasses or contacts. Be more positive! Say things like "blended vision works great" or "you can stay out of glasses."
    
    **PAIN & COMFORT:**
    - **LASIK PAIN**: LASIK feels **NO pain** during the procedure (not "little to no pain"). Through a combination of numbing eye drops and relaxing medications, you won't feel anything.
    - **AWAKE/ANESTHESIA**: If asked about being "awake," don't say "Yes." Instead, immediately mention we use **mild sedation** and relaxing medications to ensure total comfort.
    
    **AGE-BASED RECOMMENDATIONS (CRITICAL):**
    - **Under 18**: "The most important thing is making sure your prescription is stable. This usually happens around 18, but can be before or after. We'll check your eyes to make sure it's safe to proceed!"
    - **18-40**: ALL vision correction procedures work great for this age range. Only mention Lens Replacement for very high farsightedness.
    - **40-59**: Vision correction procedures absolutely work, especially with **Blended Vision**. **Lens Replacement** is also very common and has the benefit of preventing cataracts.
    - **60+**: ONLY talk about **Lens Replacement** and mention cataracts. Say: "While laser vision correction is technically possible, everyone eventually develops cataracts in this age range, so LASIK or ICLs aren't usually the best choice since the cataract might need treatment in just a few months to 10 years."
    
    **READERS & AGE:**
    - If a user asks about reading glasses, you MUST first ask for their age if not already known.
    - For age 40+, readily mention **Blended Vision** as the primary strategy.
    - **ORDER**: Explain Blended Vision FIRST (for laser procedures), THEN introduce Lens Replacement as a separate option.
    
    **BLENDED VISION RULES:**
    - **REVERSIBILITY**: When discussing blended vision being reversible, say it is **"almost always reversible"** - NOT "often reversible."
    - **FREEDOM LANGUAGE**: When talking about freedom from vision correction with blended vision, ALWAYS say **"glasses, contact lenses, or readers"** - NOT just "glasses" alone.
    
    **PROCEDURE-SPECIFIC RULES:**
    - **LASIK/SMILE/PRK HAVE NO LENSES**: These only reshape the surface of the eye with a laser. NO implants.
    - **ICL**: It IS an implant, but it is NOT a monofocal or multifocal lens.
    - **NO MONO/MULTI-FOCALS**: NEVER mention "monofocal" or "multifocal" when discussing LASIK, SMILE, ICL, or PRK. These terms ONLY apply to Cataract Surgery and Lens Replacement.
    
    **LENS REPLACEMENT RULES:**
    - **NAMING**: Never call it "RLE" alone. Say **"Lens Replacement, sometimes called Refractive Lens Exchange (RLE)."**
    - **BENEFITS**: Always mention it prevents cataracts and eliminates the need for future cataract surgery.
    - **CONTEXT**: NEVER mention multifocal lenses or IOLs without first explaining the Lens Replacement procedure.
    
    **TERMINOLOGY:**
    - **LENS PLACEMENT**: NEVER say "inside the eye." ALWAYS say **"under the surface of the eye."**
    - **INSURANCE**: When mentioning something isn't covered, say **"insurance considers it elective and does not cover it."**

User Question:
${userQuestion}

Retrieved Information:
${retrievedText}

Now answer their question conversationally using the information above. Make them feel heard and informed! If appropriate based on their question, gently guide them toward scheduling a consultation.`;
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
    'hi', 'hello', 'hey', 'howdy', 'greetings', 'sup', 'yo', 'what\'s up', 'whats up',
    'good morning', 'good afternoon', 'good evening', 'gm', 'gn',
    'how are you', 'how\'s it going', 'hows it going', 'what\'s good', 'whats good',
    'thanks', 'thank you', 'thx', 'ty', 'bye', 'goodbye', 'see ya', 'cya'
  ];
  
  return greetings.some(greeting => lowerQuery === greeting || lowerQuery.startsWith(greeting + ' ') || lowerQuery.startsWith(greeting + '!'));
}

/**
 * Detects if a query is an affirmative response (yes, sure, ok, etc.)
 * These typically follow a scheduling question and should trigger clear next steps
 * @param {string} query - User's query
 * @returns {boolean} True if it's an affirmative
 */
function isAffirmative(query) {
  const lowerQuery = query.toLowerCase().trim();
  const affirmatives = [
    'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay',
    'definitely', 'absolutely', 'of course', 'please',
    'i would', 'i\'d like', 'let\'s do it', 'sounds good',
    'sign me up', 'i\'m in', 'let\'s go', 'book it',
    'schedule', 'i want to schedule', 'i\'d like to schedule'
  ];
  
  return affirmatives.some(aff => lowerQuery === aff || lowerQuery.startsWith(aff + ' ') || lowerQuery.startsWith(aff + '!') || lowerQuery.startsWith(aff + ','));
}

/**
 * Gets the scheduling response when user says "yes" or similar
 * @returns {string} Scheduling call-to-action response
 */
function getSchedulingResponse() {
  return `Perfect! Let's get you scheduled for a consultation. You have two easy options:

📞 **Call us directly**: ${CLINIC_PHONE} - We can usually get you in within a week!

📅 **Request a callback**: Click the "Schedule Consultation" button and we'll reach out within 24 hours to find a time that works for you.

Which works better for you?`;
}

/**
 * Detects if a query is an objection/negative response (no, not sure, etc.)
 * These typically indicate concerns about cost, fear, or timing
 * @param {string} query - User's query
 * @returns {boolean} True if it's an objection
 */
function isObjection(query) {
  const lowerQuery = query.toLowerCase().trim();
  const objections = [
    'no', 'nope', 'nah', 'not really', 'not sure', 'not yet',
    'maybe', 'maybe later', 'i\'ll think about it', 'let me think',
    'i don\'t know', 'idk', 'i\'m not sure', 'not right now',
    'can\'t afford', 'too expensive', 'too much', 'costs too much',
    'scared', 'nervous', 'afraid', 'worried', 'anxious',
    'not ready', 'need to think'
  ];
  
  return objections.some(obj => lowerQuery === obj || lowerQuery.startsWith(obj + ' ') || lowerQuery.startsWith(obj + '.') || lowerQuery.startsWith(obj + ','));
}

/**
 * Gets the objection handling response - gently probes for the real concern
 * @param {string} query - The user's objection
 * @returns {string} Empathetic response that addresses concerns
 */
function getObjectionResponse(query) {
  const lowerQuery = query.toLowerCase();
  
  // Check if they explicitly mentioned cost concerns
  const isCostConcern = lowerQuery.includes('afford') || lowerQuery.includes('expensive') || 
                        lowerQuery.includes('cost') || lowerQuery.includes('too much') ||
                        lowerQuery.includes('money') || lowerQuery.includes('price');
  
  // Check if they explicitly mentioned fear/nervousness
  const isFearConcern = lowerQuery.includes('scared') || lowerQuery.includes('nervous') || 
                        lowerQuery.includes('afraid') || lowerQuery.includes('worried') ||
                        lowerQuery.includes('anxious') || lowerQuery.includes('fear');
  
  if (isCostConcern) {
    return `I completely understand - a few thousand dollars is a big decision! But let me share something that might help:

If you're spending around $180 on contacts every 90 days plus $500/year on glasses, that's over **$17,000 over 20 years**. Vision correction typically pays for itself in just a few years.

Plus, we offer **financing options** starting around $150/month, and you can use **HSA/FSA funds**. The consultation has no obligation - would you like to at least find out what your options are?`;
  }
  
  if (isFearConcern) {
    return `Those feelings are completely normal! Almost everyone feels nervous when thinking about someone working on their eyes. But I want to reassure you:

• The procedures are **incredibly safe** - our surgeons have performed thousands of them
• You'll be **extremely comfortable** the whole time with relaxing medication
• Most procedures are **over in under 10 minutes** - people often say it was done before they realized it started!
• Many of our **staff have had the procedures themselves**, so we truly understand

The consultation is no-pressure. It might help just to come in, meet the team, and see the facility. Would that help ease your mind?`;
  }
  
  // General objection - probe for the reason
  return `That's completely okay! There's no pressure at all. I'm curious though - is there something specific holding you back?

• Feeling a bit **nervous** about the procedure?
• Wondering about the **cost** or payment options?
• Just need **more time** to think it over?

Whatever it is, I'm here to help address any concerns. What's on your mind?`;
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
  // BUT exclude statements that express desire/interest in procedures (these should trigger RAG)
  const procedureInterestPatterns = [
    /want.*(get rid|remove|no more|free from).*(glasses|contacts)/i,
    /want.*(lasik|prk|smile|icl|surgery|procedure)/i,
    /interested.*(lasik|prk|smile|icl|surgery|procedure)/i,
    /considering.*(lasik|prk|smile|icl|surgery|procedure)/i,
    /looking.*(into|at).*(lasik|prk|smile|icl|surgery|procedure)/i,
    /get rid.*(glasses|contacts)/i,
    /no more.*(glasses|contacts)/i,
    // Exclude prescriptions/measurements (should trigger RAG)
    /([-+]?[0-9](\.[0-9]+)?)/, // Numbers like -9, +3.5, 2.75
    /minus|plus|diopter|astigmatism|cylinder|axis|cornea|thick|thin/i,
    /prescription|myopia|hyperopia/i
  ];
  
  // If it's about wanting procedures, getting rid of glasses, or sharing a prescription, treat it as a question (trigger RAG)
  if (procedureInterestPatterns.some(pattern => pattern.test(trimmed))) {
    return false; // Not a statement - it's a question or high-value context
  }
  
  const statementPatterns = [
    /^i (am|was|have|had|need|got|getting|scheduled|told)/i,
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
    return "You're so welcome! Happy to help. Is there anything else you'd like to know?";
  }
  
  if (lowerQuery.includes('bye') || lowerQuery.includes('goodbye') || lowerQuery.includes('see ya') || lowerQuery.includes('cya')) {
    return "Have an amazing day! Feel free to come back anytime if you have more questions. We're here to help! 😊";
  }
  
  // Casual greetings (sup, yo, what's up)
  if (lowerQuery === 'sup' || lowerQuery === 'yo' || lowerQuery.includes('what\'s up') || lowerQuery.includes('whats up') || lowerQuery.includes('what\'s good')) {
    return "Hey there! 👋 I'm here to help answer any questions you have about vision correction procedures like LASIK, SMILE, ICL, or cataract surgery. What's on your mind?";
  }
  
  // Default friendly greeting
  return "Hey! 👋 Great to meet you! I'm here to help answer all your questions about vision correction procedures—whether you're curious about LASIK, SMILE, ICL, cataract surgery, recovery, costs, or anything else. What would you like to know?";
}

/**
 * Generates a conversational prompt for statements/context
 * Uses GPT to understand context and guide users naturally
 * @param {string} statement - User's statement
 * @param {Array} conversationHistory - Previous messages
 * @returns {string} System prompt for conversational mode
 */
function getConversationalPrompt(statement, conversationHistory) {
  const lowerStatement = statement.toLowerCase();
  const isFearConcern = lowerStatement.includes('nervous') || lowerStatement.includes('worried') || 
                        lowerStatement.includes('scared') || lowerStatement.includes('afraid') || 
                        lowerStatement.includes('anxious') || lowerStatement.includes('fear');
  const isFinancialConcern = lowerStatement.includes('expensive') || lowerStatement.includes('cost') || 
                             lowerStatement.includes('afford') || lowerStatement.includes('price') ||
                             lowerStatement.includes('too much') || lowerStatement.includes('cheap');

  let specificGuidance = '';
  
  if (isFearConcern) {
    specificGuidance = `SPECIFIC GUIDANCE FOR FEAR/NERVOUSNESS:
- Acknowledge that these feelings are completely normal when thinking about someone working on your eyes
- Reassure them that the procedures are safe and efficient
- Mention that surgeons have extensive training and have performed thousands of procedures
- Explain that patients are extremely comfortable during the procedure with relaxing environment, music choice, and medications
- Note that procedures are typically over before people realize they started - they're quick and painless
- Share that most surgeons and staff have had vision correction themselves, so they understand the nervousness
- Be warm, empathetic, and encouraging`;
  }
  
  if (isFinancialConcern) {
    specificGuidance = `SPECIFIC GUIDANCE FOR FINANCIAL CONCERNS:
- Acknowledge that a few thousand dollars can be a lot for anybody
- Help them understand the long-term value by comparing to ongoing costs of glasses and contacts
- Explain that many people find the money they spend on glasses/contacts helps offset the cost over time
- Mention that most people financially break even after only a few short years
- Note that this doesn't account for the value of waking up and seeing without glasses/contacts
- Be understanding and supportive, not pushy
- Mention financing options (HSA/FSA) if relevant`;
  }

  return `You are a friendly, helpful assistant for ${CLINIC_NAME}, a refractive surgery practice.

The user just made a statement or shared context (not a direct question): "${statement}"

Your job is to:
1. Acknowledge their statement warmly and with empathy
2. Understand what they might need help with
3. ${isFearConcern || isFinancialConcern ? 'Use the specific guidance below to address their concern directly and reassuringly' : 'Guide them to ask specific questions about procedures, recovery, costs, or concerns'}
4. Be conversational and supportive
5. NEVER provide specific medical advice or diagnoses
6. If they need more specific information, suggest they ask questions or call the office

${specificGuidance}

${!isFearConcern && !isFinancialConcern ? `Examples:
- "I was told I need cataract surgery" → "I'd be happy to help! What would you like to know about cataract surgery? I can answer questions about the procedure, recovery, costs, or anything else."
- "My doctor said I'm a good candidate" → "That's great news! Do you have any questions about the procedure, what to expect, or next steps?"` : ''}

Keep responses warm, empathetic, and encouraging (3-5 sentences for fear/financial concerns, 2-3 for others).`;
}

/**
 * Detects if a query is asking about reading glasses/readers
 * @param {string} query - User's query
 * @returns {boolean} True if it's about reading glasses
 */
function isReaderQuestion(query) {
  const lowerQuery = query.toLowerCase();
  const readerKeywords = [
    'reading glasses', 'readers', 'reading glasses after', 'need reading glasses',
    'avoid reading glasses', 'reading vision', 'close up vision', 'near vision',
    'reading after', 'read after', 'small print', 'close reading'
  ];
  
  return readerKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Checks if age is mentioned in the query
 * @param {string} query - User's query
 * @returns {boolean} True if age is mentioned
 */
function hasAgeMentioned(query) {
  const lowerQuery = query.toLowerCase();
  // Check for patterns like "I'm 45", "I am 42", "age 50", "45 years old", etc.
  const agePatterns = [
    /\b(i'?m|i am|im)\s+(\d{2,3})\b/i,
    /\bage\s+(\d{2,3})\b/i,
    /\b(\d{2,3})\s+(years?\s+old|yrs?\s+old)\b/i,
    /\b(\d{2,3})\s+years?\b/i
  ];
  
  return agePatterns.some(pattern => pattern.test(query));
}

/**
 * Gets the age-request response for reader questions
 * @returns {string} Response asking for age
 */
function getAgeRequestResponse() {
  return `That's a great question! To give you the most accurate answer about reading glasses and what options might work best for you, can you tell me how old you are? The strategies we use can vary depending on your age.`;
}

module.exports = {
  generatePrompt,
  getSystemMessage,
  hasRelevantInformation,
  getFallbackResponse,
  isGreeting,
  getGreetingResponse,
  isAffirmative,
  getSchedulingResponse,
  isObjection,
  getObjectionResponse,
  isStatement,
  getConversationalPrompt,
  isReaderQuestion,
  hasAgeMentioned,
  getAgeRequestResponse,
  CLINIC_PHONE,
  CLINIC_NAME
};




