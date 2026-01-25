/**
 * Whisper Transcription Service
 * 
 * Handles audio transcription using OpenAI's Whisper API.
 * Used by clinician coaching endpoints for consult transcription.
 * 
 * IMPORTANT: This service is for CLINICIAN use only.
 * Patient-facing voice features should use a separate service.
 */

const { FormData, fetch, File } = require('undici');
require('dotenv').config();

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

  try {
    console.log(`🎤 Transcribing audio: ${filename} (${buffer.length} bytes, ${mimetype})`);

    // Create FormData for OpenAI API
    const formData = new FormData();
    
    // Add Whisper parameters
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('temperature', '0.3');
    formData.append('language', 'en');
    
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
    
    // Create File object for undici FormData
    const audioFile = new File([buffer], safeFilename, {
      type: mimetype || 'audio/webm'
    });
    
    formData.append('file', audioFile);

    console.log('🔄 Sending to OpenAI Whisper API...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI API error: ${response.status}`, errorText);
      
      // Parse common errors
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid OpenAI API key'
        };
      }
      if (response.status === 413) {
        return {
          success: false,
          error: 'Audio file too large for OpenAI (max 25MB)'
        };
      }
      if (response.status === 400 && errorText.includes('Invalid file format')) {
        return {
          success: false,
          error: 'Unsupported audio format. Use mp3, wav, webm, m4a, or ogg.'
        };
      }
      
      return {
        success: false,
        error: `OpenAI API error: ${response.status} - ${errorText}`
      };
    }

    const transcript = await response.text();
    
    console.log(`✅ Transcription completed: ${transcript.length} characters`);
    
    return {
      success: true,
      transcript: transcript.trim()
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
    
    return {
      success: false,
      error: `Transcription failed: ${error.message}`
    };
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
