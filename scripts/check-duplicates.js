/**
 * Content Quality Checker
 * 
 * Scans content files for:
 * - Duplicate/similar chunks (potential redundancy)
 * - Helps identify potential contradictions
 * 
 * Run with: node scripts/check-duplicates.js
 */

const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CONTENT_DIR = path.join(__dirname, '../content');

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Simple text chunking (matches index.js logic)
 */
function chunkText(text, size = 300, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ').trim();
    if (chunk.length > 0) chunks.push(chunk);
    i += size - overlap;
  }
  return chunks;
}

async function main() {
  console.log('\n🔍 Content Quality Check\n');
  console.log('='.repeat(50));

  // Load all content files
  const files = await fs.readdir(CONTENT_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  
  const allChunks = [];
  
  for (const file of mdFiles) {
    const content = await fs.readFile(path.join(CONTENT_DIR, file), 'utf-8');
    const text = content.replace(/[#*_`]/g, ' ').replace(/\s+/g, ' ').trim();
    const chunks = chunkText(text);
    
    chunks.forEach((chunk, idx) => {
      allChunks.push({
        file,
        chunkIdx: idx,
        text: chunk.substring(0, 200) + '...', // Preview
        fullText: chunk
      });
    });
  }

  console.log(`\n📊 Loaded ${allChunks.length} chunks from ${mdFiles.length} files\n`);

  // Generate embeddings for all chunks
  console.log('🧠 Generating embeddings...');
  const embeddings = [];
  
  const batchSize = 50;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map(c => c.fullText)
    });
    embeddings.push(...response.data.map(d => d.embedding));
  }

  // Find similar pairs
  console.log('\n🔄 Checking for similar content...\n');
  
  const SIMILARITY_THRESHOLD = 0.85; // Very similar
  const duplicates = [];

  for (let i = 0; i < allChunks.length; i++) {
    for (let j = i + 1; j < allChunks.length; j++) {
      // Skip chunks from same file
      if (allChunks[i].file === allChunks[j].file) continue;
      
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        duplicates.push({
          similarity: similarity.toFixed(3),
          chunk1: allChunks[i],
          chunk2: allChunks[j]
        });
      }
    }
  }

  // Report findings
  if (duplicates.length === 0) {
    console.log('✅ No highly similar content found across files!');
    console.log('   Your content appears to be well-organized.\n');
  } else {
    console.log(`⚠️  Found ${duplicates.length} potentially redundant content pairs:\n`);
    
    duplicates.sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity));
    
    duplicates.slice(0, 10).forEach((dup, idx) => {
      console.log(`${idx + 1}. Similarity: ${dup.similarity}`);
      console.log(`   📄 ${dup.chunk1.file} (chunk ${dup.chunk1.chunkIdx})`);
      console.log(`   📄 ${dup.chunk2.file} (chunk ${dup.chunk2.chunkIdx})`);
      console.log(`   Preview 1: "${dup.chunk1.text.substring(0, 100)}..."`);
      console.log(`   Preview 2: "${dup.chunk2.text.substring(0, 100)}..."`);
      console.log('');
    });

    console.log('\n💡 Recommendation:');
    console.log('   Review these pairs and consolidate similar content');
    console.log('   into a single authoritative source.\n');
  }

  console.log('='.repeat(50));
  console.log('Done!\n');
}

main().catch(console.error);

