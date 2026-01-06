/**
 * Indexing Script for FAQ Content
 * 
 * This script:
 * 1. Loads all markdown files from /content/
 * 2. Parses and chunks the content
 * 3. Generates embeddings using OpenAI
 * 4. Stores vectors in ChromaDB
 * 
 * Run with: npm run index
 */

const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');
const MarkdownIt = require('markdown-it');
const { isSupabaseConfigured } = require('../server/supabase');
// Use Supabase vector store if configured, otherwise fall back to local
const vectorStore = require('../server/vectorstore-supabase');
const { addDocuments, deleteCollection } = vectorStore;
require('dotenv').config();

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const md = new MarkdownIt();

// Configuration
const CONTENT_DIR = path.join(__dirname, '../content');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || 'faq_collection';
const CHUNK_SIZE = 300; // Target words per chunk
const CHUNK_OVERLAP = 50; // Overlap words between chunks

/**
 * Load all markdown files from content directory
 * @returns {Promise<Array>} Array of {filename, content} objects
 */
async function loadMarkdownFiles() {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    const markdownFiles = files.filter(f => f.endsWith('.md'));

    console.log(`📂 Found ${markdownFiles.length} markdown files`);

    const fileContents = [];
    for (const filename of markdownFiles) {
      const filepath = path.join(CONTENT_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      fileContents.push({
        filename: filename,
        content: content
      });
      console.log(`   ✓ Loaded: ${filename}`);
    }

    return fileContents;
  } catch (error) {
    console.error('❌ Error loading markdown files:', error.message);
    throw error;
  }
}

/**
 * Parse markdown and extract clean text
 * @param {string} markdown - Raw markdown content
 * @returns {string} Clean text without markdown syntax
 */
function parseMarkdown(markdown) {
  // Convert markdown to HTML
  const html = md.render(markdown);
  
  // Remove HTML tags to get plain text
  const text = html
    .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
    .replace(/&nbsp;/g, ' ')    // Replace nbsp
    .replace(/&amp;/g, '&')     // Replace amp
    .replace(/&lt;/g, '<')      // Replace lt
    .replace(/&gt;/g, '>')      // Replace gt
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
  
  return text;
}

/**
 * Split text into overlapping chunks
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Target words per chunk
 * @param {number} overlap - Overlap words between chunks
 * @returns {Array<string>} Array of text chunks
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const words = text.split(/\s+/);
  const chunks = [];
  
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    
    // Move forward by (chunkSize - overlap) to create overlap
    i += chunkSize - overlap;
    
    // Ensure we don't create tiny chunks at the end
    if (i < words.length && i + chunkSize > words.length) {
      // If remaining words are less than half chunk size, include in last chunk
      if (words.length - i < chunkSize / 2 && chunks.length > 0) {
        break;
      }
    }
  }
  
  return chunks;
}

/**
 * Process a single markdown file into chunks
 * @param {Object} file - File object with filename and content
 * @returns {Array} Array of chunk objects
 */
function processFile(file) {
  const { filename, content } = file;
  
  // Parse markdown to plain text
  const text = parseMarkdown(content);
  
  // Split into chunks
  const chunks = chunkText(text);
  
  // Create chunk objects with metadata
  const chunkObjects = chunks.map((chunkText, idx) => ({
    id: `${filename.replace('.md', '')}_chunk_${idx}`,
    text: chunkText,
    metadata: {
      filename: filename,
      chunkId: idx,
      totalChunks: chunks.length
    }
  }));
  
  console.log(`   ✓ Processed ${filename}: ${chunks.length} chunks`);
  return chunkObjects;
}

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @returns {Promise<Array<number>>} Embedding vector
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float'
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Generate embeddings for all chunks in batches
 * @param {Array} chunks - Array of chunk objects
 * @returns {Promise<Array>} Array of embeddings
 */
async function generateEmbeddings(chunks) {
  console.log(`🧠 Generating embeddings for ${chunks.length} chunks...`);
  
  const embeddings = [];
  const batchSize = 100; // OpenAI allows up to 2048, but we'll use smaller batches
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);
    
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        encoding_format: 'float'
      });
      
      const batchEmbeddings = response.data.map(d => d.embedding);
      embeddings.push(...batchEmbeddings);
      
      console.log(`   ✓ Embedded ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`);
    } catch (error) {
      console.error(`❌ Error embedding batch ${i}-${i + batchSize}:`, error.message);
      throw error;
    }
  }
  
  return embeddings;
}

/**
 * Initialize or reset local vector store
 */
async function initializeCollection() {
  try {
    // Delete existing collection
    await deleteCollection();
    console.log(`✅ Vector store ready: ${COLLECTION_NAME}`);
    return true;
  } catch (error) {
    console.error('❌ Error initializing collection:', error.message);
    throw error;
  }
}

/**
 * Add chunks with embeddings to local vector store
 * @param {Array} chunks - Chunk objects
 * @param {Array} embeddings - Embedding vectors
 */
async function addToVectorStore(chunks, embeddings) {
  try {
    // Format documents for storage
    const documents = chunks.map((chunk, idx) => ({
      id: chunk.id,
      document: chunk.text,
      embedding: embeddings[idx],
      metadata: chunk.metadata
    }));
    
    await addDocuments(documents);
    console.log(`✅ Added ${chunks.length} chunks to vector store`);
  } catch (error) {
    console.error('❌ Error adding to vector store:', error.message);
    throw error;
  }
}

/**
 * Main indexing function
 */
async function main() {
  console.log('\n🚀 Starting FAQ Indexing Process\n');
  console.log('='.repeat(50));
  
  try {
    // Step 1: Load markdown files
    console.log('\n📖 Step 1: Loading markdown files...');
    const files = await loadMarkdownFiles();
    
    if (files.length === 0) {
      console.log('⚠️  No markdown files found in /content/ directory');
      return;
    }
    
    // Step 2: Process files into chunks
    console.log('\n✂️  Step 2: Chunking content...');
    let allChunks = [];
    for (const file of files) {
      const chunks = processFile(file);
      allChunks = allChunks.concat(chunks);
    }
    
    console.log(`\n📊 Total chunks created: ${allChunks.length}`);
    
    // Step 3: Generate embeddings
    console.log('\n🧠 Step 3: Generating embeddings...');
    const embeddings = await generateEmbeddings(allChunks);
    
    // Step 4: Initialize vector store (Supabase or local)
    const storeType = isSupabaseConfigured() ? 'Supabase pgvector' : 'local JSON';
    console.log(`\n💾 Step 4: Initializing ${storeType} vector store...`);
    await initializeCollection();
    
    // Step 5: Add chunks to vector store
    console.log('\n📥 Step 5: Adding chunks to vector database...');
    await addToVectorStore(allChunks, embeddings);
    
    // Success!
    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Files processed: ${files.length}`);
    console.log(`   - Total chunks: ${allChunks.length}`);
    console.log(`   - Collection: ${COLLECTION_NAME}`);
    console.log(`\n🎉 Your FAQ assistant is ready to use!`);
    console.log(`   Run: npm start\n`);
    
  } catch (error) {
    console.error('\n❌ Indexing failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the indexing process
if (require.main === module) {
  main();
}

module.exports = {
  loadMarkdownFiles,
  parseMarkdown,
  chunkText,
  processFile,
  generateEmbedding,
  generateEmbeddings,
  initializeCollection,
  addToVectorStore
};

