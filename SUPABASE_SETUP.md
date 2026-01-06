# Supabase Setup Guide

This guide walks you through setting up Supabase as your vector database for PNVGPT.

## Why Supabase?

| Feature | Local JSON (current) | Supabase pgvector |
|---------|---------------------|-------------------|
| **Speed** | O(n) linear search | O(log n) indexed search |
| **Scalability** | ~100 chunks max | 100,000+ chunks |
| **Memory** | Loads all into RAM | Database handles it |
| **Persistence** | File on disk | Cloud database |
| **Cost** | Free | Free tier: 500MB |

## Setup Steps

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click "New Project"
3. Choose a name (e.g., `pnvgpt-prod`)
4. Set a strong database password (save it!)
5. Choose region closest to your users
6. Wait ~2 minutes for project to provision

### Step 2: Run Database Migration

1. In your Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/001_create_vector_store.sql`
4. Paste into the SQL Editor
5. Click **Run** (or Cmd+Enter)
6. You should see "Success. No rows returned"

### Step 3: Get API Keys

1. Go to **Settings** > **API** (left sidebar)
2. Copy these values to your `.env` file:

```env
# Project URL (under "Project URL")
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Service Role Key (under "Project API keys" - use service_role, NOT anon)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Important**: Use the `service_role` key, not the `anon` key. The service key is needed to bypass Row Level Security for server-side operations.

### Step 4: Index Your Content

```bash
# Install the new Supabase dependency
npm install

# Index your content to Supabase
npm run index
```

You should see output like:
```
🚀 Starting FAQ Indexing Process
📖 Step 1: Loading markdown files...
   ✓ Loaded: 01-cost-and-insurance.md
   ✓ Loaded: 02-surgery-day-procedure.md
   ...
✂️  Step 2: Chunking content...
🧠 Step 3: Generating embeddings...
💾 Step 4: Initializing Supabase pgvector vector store...
✅ Supabase vector store ready
📥 Step 5: Adding chunks to vector database...
   ✓ Inserted 50/50 chunks
✅ Added 50 documents to Supabase
```

### Step 5: Verify in Supabase

1. Go to **Table Editor** in Supabase dashboard
2. Click on `content_chunks` table
3. You should see all your content chunks with embeddings

### Step 6: Test It

```bash
# Start the server
npm start

# Test a query
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LASIK?"}'
```

Check the `/health` endpoint to verify:
```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "healthy",
  "components": {
    "openai": true,
    "vectorStore": true,
    "vectorProvider": "supabase",
    "collection": true,
    "documentCount": 50
  }
}
```

## Troubleshooting

### "relation 'content_chunks' does not exist"

The migration hasn't been run. Go to SQL Editor and run `001_create_vector_store.sql`.

### "Could not find the function match_content_chunks"

Same as above - the function is created by the migration.

### "Invalid API key"

Make sure you're using `SUPABASE_SERVICE_KEY` (the service_role key), not the anon key.

### "permission denied for table content_chunks"

You might be using the anon key instead of service_role key.

### Falling back to local store

If you see "Using local vector store", check:
1. `SUPABASE_URL` is set correctly
2. `SUPABASE_SERVICE_KEY` is set correctly
3. Both are in your `.env` file (not `.env.example`)

## Monitoring

### View Query Performance

In Supabase Dashboard:
1. Go to **Database** > **Query Performance**
2. Look for queries on `content_chunks` table

### View Logs

1. Go to **Logs** in Supabase dashboard
2. Filter by "Postgres" to see database queries

## Scaling Tips

### For 1,000+ chunks

Run this to optimize the vector index:
```sql
-- Drop the existing index
DROP INDEX IF EXISTS content_chunks_embedding_idx;

-- Create optimized HNSW index (faster for larger datasets)
CREATE INDEX content_chunks_embedding_idx 
ON content_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### For Production

1. Enable **Row Level Security** (see migration file)
2. Set up database backups (Supabase dashboard > Settings > Database)
3. Consider upgrading to Pro tier for better performance ($25/month)

