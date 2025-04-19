#!/bin/bash

echo "🚀 Starting WebShell Frontend..."

# Navigate to frontend directory
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  npm install
else
  echo "✅ Frontend dependencies already installed."
fi

# Start the development server
echo "🌐 Starting Vite dev server..."
npm run dev 