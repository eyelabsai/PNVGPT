/**
 * Whisper Transcription Service
 * 
 * Handles audio transcription using OpenAI's Whisper API.
 * Used by clinician coaching endpoints for consult transcription.
 * 
 * IMPORTANT: This service is for CLINICIAN use only.
 * Patient-facing voice features should use a separate service.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Transcribe audio buffer using OpenAI Whisper API
 * 
 * @param {Object} options - Transcription options
 * @param {Buffer} options.buffer - Audio file buffer
 * @param {string} options.filename - Original filename
 * @param {string} options.mimetype - Audio MIME type
 * @returns {Promise<Object>} - { success: true, transcript: string } or { success: false, error: string }
 */
async function transcribeAudioBuffer({ buffer, filename, mimetype }) {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not configured');
    return {
      success: false,
      error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
    };
  }

  // Create a temporary file to store the audio buffer
  let tempFilePath = null;
  
  try {
    console.log(`🎤 Transcribing audio: ${filename} (${buffer.length} bytes, ${mimetype})`);

    // Fix filename - ensure proper extension for OpenAI validation
    let safeFilename = filename;
    if (!filename || filename === 'blob') {
      // Determine extension from mimetype
      const extMap = {
        'audio/webm': 'recording.webm',
        'audio/mp3': 'recording.mp3',
        'audio/mpeg': 'recording.mp3',
        'audio/wav': 'recording.wav',
        'audio/x-wav': 'recording.wav',
        'audio/m4a': 'recording.m4a',
        'audio/mp4': 'recording.m4a',
        'audio/ogg': 'recording.ogg'
      };
      safeFilename = extMap[mimetype] || 'recording.webm';
    } else if (!filename.includes('.')) {
      // Add extension if missing
      safeFilename = filename + '.webm';
    }
    
    console.log(`📁 Using filename: ${safeFilename}`);
    
    // Write buffer to temp file (OpenAI SDK requires file path or stream)
    tempFilePath = path.join(os.tmpdir(), `whisper_${Date.now()}_${safeFilename}`);
    fs.writeFileSync(tempFilePath, buffer);
    
    console.log('🔄 Sending to OpenAI Whisper API...');
    
    // Use OpenAI SDK for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      response_format: 'text',
      temperature: 0.3,
      language: 'en'
    });
    
    console.log(`✅ Transcription completed: ${transcription.length} characters`);
    
    return {
      success: true,
      transcript: transcription.trim()
    };

  } catch (error) {
    console.error('❌ Transcription error:', error);
    
    // Handle specific error types
    if (error.message && error.message.includes('timeout')) {
      return {
        success: false,
        error: 'Audio processing timed out. Please try a shorter recording.'
      };
    }
    if (error.message && error.message.includes('ECONNREFUSED')) {
      return {
        success: false,
        error: 'Could not connect to OpenAI API. Please check your network.'
      };
    }
    if (error.status === 401) {
      return {
        success: false,
        error: 'Invalid OpenAI API key'
      };
    }
    if (error.status === 413) {
      return {
        success: false,
        error: 'Audio file too large for OpenAI (max 25MB)'
      };
    }
    
    return {
      success: false,
      error: `Transcription failed: ${error.message}`
    };
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Check if Whisper service is properly configured
 * @returns {Object} - { configured: boolean, error?: string }
 */
function checkConfiguration() {
  if (!process.env.OPENAI_API_KEY) {
    return {
      configured: false,
      error: 'OPENAI_API_KEY environment variable not set'
    };
  }
  return { configured: true };
}

module.exports = {
  transcribeAudioBuffer,
  checkConfiguration
};
