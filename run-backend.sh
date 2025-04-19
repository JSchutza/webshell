#!/bin/bash

echo "🚀 Starting WebShell Backend..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  npm install
else
  echo "✅ Backend dependencies already installed."
fi

# Check if Docker is running
echo "🐳 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
else
  echo "✅ Docker is running."
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "⚠️ .env file not found, creating default .env file..."
  echo "PORT=3001" > .env
  echo "ALLOWED_COMMANDS=ls,pwd,cat,echo,mkdir,touch,whoami,date,uptime,tree" >> .env
  echo "COMMAND_TIMEOUT=5000" >> .env
  echo "SESSION_TIMEOUT=1800000" >> .env
  echo "✅ Created default .env file."
else
  echo "✅ .env file found."
fi

# Start the backend server
echo "🖥️ Starting Express server..."
npm run dev 