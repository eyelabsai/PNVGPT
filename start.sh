#!/bin/bash

echo "🚀 Starting PNVGPT..."

# Check if FORCE_REINDEX is set or if this is first deploy
if [ "$FORCE_REINDEX" = "true" ]; then
    echo "🔄 FORCE_REINDEX enabled. Running indexing..."
    npm run index
elif [ "$SUPABASE_URL" != "" ] && [ ! -f "/tmp/.indexed" ]; then
    # For Supabase, run indexing on first deploy
    echo "⚠️  First deploy detected. Running indexing..."
    npm run index
    touch /tmp/.indexed
elif [ ! -f "./vector-store/collection.json" ]; then
    # For local vector store, check if file exists
    echo "⚠️  Vector store not found. Running indexing..."
    npm run index
else
    echo "✅ Vector store ready"
fi

# Start the server
echo "🚀 Starting server..."
node server/app.js
