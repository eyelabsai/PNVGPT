-- ============================================
-- PNVGPT Vector Store Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create content_chunks table
CREATE TABLE IF NOT EXISTS content_chunks (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create index for faster vector search (IVFFlat)
-- Note: Run this AFTER you have some data (at least 100 rows)
-- For now, we'll use exact search which works for smaller datasets
CREATE INDEX IF NOT EXISTS content_chunks_embedding_idx 
ON content_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- If the above fails (not enough data), use this simpler index:
-- CREATE INDEX IF NOT EXISTS content_chunks_embedding_idx 
-- ON content_chunks 
-- USING hnsw (embedding vector_cosine_ops);

-- Step 4: Create the similarity search function
CREATE OR REPLACE FUNCTION match_content_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  source_file TEXT,
  chunk_index INTEGER,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.source_file,
    cc.chunk_index,
    cc.content,
    cc.metadata,
    1 - (cc.embedding <=> query_embedding) AS similarity
  FROM content_chunks cc
  WHERE 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 5: Create conversation_logs table (for analytics)
CREATE TABLE IF NOT EXISTS conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  response_time_ms INTEGER,
  chunks_used JSONB DEFAULT '[]',
  was_fallback BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Create content_sources table (for admin panel - future)
CREATE TABLE IF NOT EXISTS content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_indexed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Create indexes for common queries
CREATE INDEX IF NOT EXISTS conversation_logs_created_at_idx ON conversation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_logs_session_idx ON conversation_logs(session_id);
CREATE INDEX IF NOT EXISTS content_chunks_source_file_idx ON content_chunks(source_file);

-- Step 8: Enable Row Level Security (optional, for production)
-- ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversation_logs ENABLE ROW LEVEL SECURITY;

-- Step 9: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_chunks_updated_at
  BEFORE UPDATE ON content_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_sources_updated_at
  BEFORE UPDATE ON content_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE! Your vector store is ready.
-- ============================================
-- 
-- Next steps:
-- 1. Copy your SUPABASE_URL and SUPABASE_SERVICE_KEY to .env
-- 2. Run: npm run index (to populate the vector store)
-- 3. Run: npm start (to test)
-- ============================================

