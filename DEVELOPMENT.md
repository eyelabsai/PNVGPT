# 🛠️ Development Guide

Technical documentation for developers working on PNVGPT.

## Architecture Overview

```
User Question
     ↓
Express API (/ask)
     ↓
RAG Pipeline:
  1. Embed query (OpenAI)
  2. Vector search (ChromaDB)
  3. Retrieve top-k chunks
  4. Generate prompt with safety rules
  5. Call GPT-4o-mini
  6. Return answer
     ↓
Log to Firebase (async)
     ↓
Return JSON response
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 16+ | Server execution |
| API Framework | Express.js | REST API endpoints |
| Vector DB | ChromaDB | Semantic search |
| Embeddings | OpenAI text-embedding-3-small | Convert text to vectors |
| LLM | OpenAI GPT-4o-mini | Answer generation |
| Analytics | Firebase Firestore | Query logging |
| Content | Markdown | FAQ storage |

## File Structure Details

### `/content/` - FAQ Content
- Markdown files with practice FAQs
- Automatically parsed and chunked
- Version control recommended

### `/scripts/index.js` - Indexing Pipeline
- Loads all `.md` files
- Parses markdown to plain text
- Chunks into ~300 word segments
- Generates embeddings
- Stores in ChromaDB

**Key functions:**
- `loadMarkdownFiles()` - Read files from disk
- `parseMarkdown()` - Convert MD to text
- `chunkText()` - Split into chunks
- `generateEmbeddings()` - Batch embed
- `initializeCollection()` - Setup ChromaDB

### `/server/prompt.js` - Safety Layer
- Defines strict rules for LLM
- Prevents hallucinations
- Enforces fallback responses
- Practice-specific phrasing

**Key functions:**
- `generatePrompt()` - Create final prompt
- `getFallbackResponse()` - Default response
- `hasRelevantInformation()` - Validate retrieval

### `/server/rag.js` - RAG Logic
- Core retrieval and generation pipeline
- Handles embeddings
- Manages ChromaDB queries
- Calls OpenAI API

**Key functions:**
- `embedText()` - Single text embedding
- `retrieveRelevant()` - Vector search
- `generateAnswer()` - Main pipeline
- `healthCheck()` - System diagnostics

### `/server/firebase.js` - Analytics
- Firebase Admin SDK initialization
- Query logging
- Event tracking
- Optional feature (graceful fallback)

**Key functions:**
- `initializeFirebase()` - Setup SDK
- `logQuery()` - Log user interactions
- `logEvent()` - System events
- `getQueryLogs()` - Retrieve history

### `/server/app.js` - Express Server
- REST API endpoints
- Request validation
- Error handling
- Future feature scaffolding

**Endpoints:**
- `POST /ask` - Main FAQ endpoint
- `GET /health` - System health
- `GET /status` - Uptime check

## Configuration Parameters

### Embedding Settings

```javascript
// scripts/index.js & server/rag.js
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 300;        // Words per chunk
const CHUNK_OVERLAP = 50;      // Overlap between chunks
```

**Tuning guidance:**
- Smaller chunks (200-250): More precise, more chunks
- Larger chunks (350-500): More context, fewer chunks
- Overlap (30-80): Balance between redundancy and coverage

### Retrieval Settings

```javascript
// server/rag.js
const TOP_K_RESULTS = 3;              // Number of chunks
const SIMILARITY_THRESHOLD = 0.5;     // Min similarity (0-1)
```

**Tuning guidance:**
- More chunks (4-5): Better coverage, more tokens
- Fewer chunks (2): Faster, more focused
- Higher threshold (0.6-0.7): More confident, more fallbacks
- Lower threshold (0.4): More answers, less precise

### Generation Settings

```javascript
// server/rag.js - openai.chat.completions.create()
temperature: 0.3,    // Lower = more consistent
max_tokens: 300,     // Max response length
top_p: 0.9          // Nucleus sampling
```

**Tuning guidance:**
- Temperature 0.1-0.3: Factual, consistent
- Temperature 0.4-0.7: More creative (not recommended)
- Max tokens 200-400: Balance length vs cost

## Development Workflow

### 1. Local Development

```bash
# Install
npm install

# Run in dev mode with auto-reload
npm run dev

# Or start normally
npm start
```

### 2. Content Updates

```bash
# Edit markdown files in /content/

# Re-index
npm run index

# Restart server
npm start
```

### 3. Testing Changes

```bash
# Health check
curl http://localhost:3000/health

# Test query
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "test question"}'
```

### 4. Monitor Logs

```bash
# Server logs show:
# - Incoming requests
# - Retrieval results
# - Response times
# - Errors/warnings

# Firebase Console shows:
# - Query history
# - Usage patterns
# - Popular questions
```

## API Response Format

### Success Response

```javascript
{
  answer: string,           // Generated answer
  metadata: {
    responseTime: number,   // Total ms
    retrievedChunks: number,// Chunks used
    usedFallback: boolean,  // Safety fallback?
    timestamp: number       // Unix timestamp
  }
}
```

### Error Response

```javascript
{
  error: string,            // Error type
  message: string           // User-friendly message
}
```

## Database Schema

### ChromaDB Collection

```javascript
{
  id: "filename_chunk_0",
  embedding: [0.123, -0.456, ...],  // 1536 dims
  document: "chunk text...",
  metadata: {
    filename: "lasik-basics.md",
    chunkId: 0,
    totalChunks: 8
  }
}
```

### Firestore `faq_logs` Collection

```javascript
{
  question: string,
  answer: string,
  retrievedChunks: [
    {
      id: string,
      filename: string,
      similarity: number
    }
  ],
  timestamp: Timestamp,
  createdAt: Timestamp,
  metadata: {
    responseTime: number,
    chunkCount: number,
    tokensUsed: number,
    model: string
  }
}
```

## Cost Optimization

### Embedding Costs
- Model: `text-embedding-3-small`
- Cost: ~$0.02 per 1M tokens
- Average FAQ (5 files): ~$0.001 per index

### Generation Costs
- Model: `gpt-4o-mini`
- Cost: ~$0.15 per 1M input tokens
- Cost: ~$0.60 per 1M output tokens
- Average query: ~$0.0005-0.001

**Monthly estimate (1000 queries/month):**
- Embeddings: ~$0.001 (one-time)
- Generation: ~$0.50-1.00
- Total: **< $2/month**

## Performance Optimization

### 1. Caching
```javascript
// Consider adding Redis for:
// - Frequent questions
// - Embeddings cache
// - Response cache
```

### 2. Batch Processing
```javascript
// Already implemented in scripts/index.js
// Embeds in batches of 100
```

### 3. Connection Pooling
```javascript
// OpenAI client reuses connections
// ChromaDB client persistent
```

## Security Considerations

### 1. Input Validation
- Query length limited to 500 chars
- Sanitization in `app.js`
- Type checking

### 2. Output Safety
- Prompt-based constraints
- No PII in responses
- Fallback for uncertain cases

### 3. API Security
- Helmet.js security headers
- CORS configured
- Rate limiting (TODO)

### 4. Data Privacy
- No user identifiers logged
- HIPAA-compliant logging
- No medical diagnosis

## Monitoring & Debugging

### Debug Mode

```javascript
// server/rag.js
console.log(`📚 Retrieved ${chunks.length} chunks`);
console.log(`✅ Response sent (${responseTime}ms)`);
```

### Firebase Analytics Queries

```javascript
// Get popular questions
const logs = await getQueryLogs({ limit: 100 });
const questions = logs.map(l => l.question);
const popular = getMostCommon(questions);
```

### Health Monitoring

```bash
# Check all systems
curl http://localhost:3000/health

# Expected:
{
  "status": "healthy",
  "components": {
    "openai": true,
    "chromadb": true,
    "collection": true,
    "documentCount": 45
  }
}
```

## Testing Strategy

### Unit Tests (TODO)
```javascript
// Test individual functions
test('chunkText splits correctly', () => {
  const chunks = chunkText('word '.repeat(400), 300, 50);
  expect(chunks.length).toBeGreaterThan(1);
});
```

### Integration Tests (TODO)
```javascript
// Test full pipeline
test('generates answer from query', async () => {
  const result = await generateAnswer('What is LASIK?');
  expect(result.answer).toBeTruthy();
  expect(result.usedFallback).toBe(false);
});
```

### Manual Testing
1. Test common questions
2. Test edge cases (empty, long, irrelevant)
3. Test error handling (API down, etc.)
4. Test response quality

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use process manager (PM2)
- [ ] Set up reverse proxy (nginx)
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Test error scenarios
- [ ] Document runbooks
- [ ] Set up alerts

## Troubleshooting

### High Response Times
- Check OpenAI API latency
- Reduce `TOP_K_RESULTS`
- Cache frequent queries

### Poor Answer Quality
- Improve markdown content
- Adjust similarity threshold
- Increase chunk overlap
- Review prompt engineering

### High Costs
- Use smaller embeddings model
- Reduce max_tokens
- Cache responses
- Optimize chunk sizes

## Future Enhancements

### Short Term
- [ ] Add response caching
- [ ] Implement rate limiting
- [ ] Add user feedback collection
- [ ] Analytics dashboard

### Medium Term
- [ ] Multi-language support
- [ ] Voice input (Whisper)
- [ ] Admin content editor
- [ ] A/B testing framework

### Long Term
- [ ] Multi-modal (images)
- [ ] Personalization
- [ ] Integration with EHR
- [ ] Mobile apps

## Contributing Guidelines

1. Follow existing code style
2. Add comments for complex logic
3. Update documentation
4. Test thoroughly
5. Consider security implications
6. Optimize for cost

---

**Questions?** Review code comments or contact the development team.



