#!/bin/bash

echo "🚀 Starting PNVGPT..."

# Check if vector store exists
if [ ! -f "./vector-store/collection.json" ]; then
    echo "⚠️  Vector store not found. Running indexing..."
    npm run index
else
    echo "✅ Vector store exists"
fi

# Start the server
echo "🚀 Starting server..."
node server/app.js
