/**
 * Supabase Client Configuration
 * 
 * Handles connection to Supabase for:
 * - Vector storage (pgvector)
 * - Content management
 * - Query logging
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key for server-side

let supabase = null;

/**
 * Initialize Supabase client
 * @returns {Object} Supabase client instance
 */
function initializeSupabase() {
  if (supabase) {
    return supabase;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  Supabase credentials not found. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
    console.warn('⚠️  Falling back to local vector store');
    return null;
  }

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Supabase client initialized');
    return supabase;
  } catch (error) {
    console.error('❌ Failed to initialize Supabase:', error.message);
    return null;
  }
}

/**
 * Get the Supabase client instance
 * @returns {Object|null} Supabase client or null if not initialized
 */
function getSupabase() {
  if (!supabase) {
    return initializeSupabase();
  }
  return supabase;
}

/**
 * Check if Supabase is available
 * @returns {boolean} True if Supabase is configured
 */
function isSupabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

module.exports = {
  initializeSupabase,
  getSupabase,
  isSupabaseConfigured
};

