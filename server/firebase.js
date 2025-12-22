/**
 * Firebase Firestore Integration
 * 
 * Handles Firebase initialization and logging for the FAQ system.
 * All logs are stored in Firestore for analytics and monitoring.
 */

const admin = require('firebase-admin');
require('dotenv').config();

let db = null;
let isInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  if (isInitialized) {
    return db;
  }

  try {
    // Option 1: Using environment variables
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
      
      console.log('✅ Firebase initialized with environment variables');
    } 
    // Option 2: Using service account file
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      
      console.log('✅ Firebase initialized with service account file');
    }
    // Option 3: Fall back to local file
    else {
      const serviceAccount = require('../firebase-service-account.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log('✅ Firebase initialized with local service account');
    }

    db = admin.firestore();
    isInitialized = true;
    
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.warn('⚠️  Logging will be disabled. Add Firebase credentials to enable logging.');
    return null;
  }
}

/**
 * Log a user query and response to Firestore
 * @param {Object} logData - The data to log
 * @param {string} logData.question - User's question
 * @param {string} logData.answer - Generated answer
 * @param {Array} logData.retrievedChunks - Array of chunk metadata
 * @param {number} logData.timestamp - Unix timestamp
 * @param {Object} logData.metadata - Additional metadata (optional)
 */
async function logQuery(logData) {
  if (!db) {
    console.warn('⚠️  Firebase not initialized - skipping log');
    return null;
  }

  try {
    const {
      question,
      answer,
      retrievedChunks = [],
      timestamp = Date.now(),
      metadata = {}
    } = logData;

    // Prepare log document (HIPAA-safe - no PII)
    const logDocument = {
      question: question || '',
      answer: answer || '',
      retrievedChunks: retrievedChunks.map(chunk => ({
        id: chunk.id || '',
        filename: chunk.filename || '',
        similarity: chunk.similarity || 0
      })),
      timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        responseTime: metadata.responseTime || 0,
        chunkCount: retrievedChunks.length,
        ...metadata
      }
    };

    // Write to Firestore collection
    const docRef = await db.collection('faq_logs').add(logDocument);
    
    console.log(`📝 Query logged: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error logging query:', error.message);
    return null;
  }
}

/**
 * Log system events (errors, warnings, etc.)
 * @param {string} level - Log level (info, warning, error)
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
async function logEvent(level, message, data = {}) {
  if (!db) {
    console.warn('⚠️  Firebase not initialized - skipping event log');
    return null;
  }

  try {
    const eventDocument = {
      level: level || 'info',
      message: message || '',
      data: data,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('system_logs').add(eventDocument);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error logging event:', error.message);
    return null;
  }
}

/**
 * Get query logs with optional filtering
 * @param {Object} options - Query options
 * @param {number} options.limit - Max number of records
 * @param {Date} options.startDate - Start date filter
 * @param {Date} options.endDate - End date filter
 * @returns {Array} Array of log documents
 */
async function getQueryLogs(options = {}) {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    let query = db.collection('faq_logs');

    if (options.startDate) {
      query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(options.startDate));
    }

    if (options.endDate) {
      query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(options.endDate));
    }

    query = query.orderBy('timestamp', 'desc');

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('❌ Error fetching logs:', error.message);
    throw error;
  }
}

/**
 * Future placeholder: Get analytics data
 */
async function getAnalytics() {
  // TODO: Implement analytics aggregation
  console.log('📊 Analytics feature - to be implemented');
  return {
    totalQueries: 0,
    avgResponseTime: 0,
    topQuestions: []
  };
}

module.exports = {
  initializeFirebase,
  logQuery,
  logEvent,
  getQueryLogs,
  getAnalytics
};




