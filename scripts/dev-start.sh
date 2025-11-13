#!/bin/bash
set -e

echo "🚀 Starting Data Deals development environment..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please edit it with your configuration."
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm packages..."
    npm install
else
    echo "📦 Updating npm packages..."
    npm install
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Check if database exists, if not create it
if [ ! -f "prisma/dev.db" ]; then
    echo "🗄️  Creating database..."
    npx prisma db push
else
    echo "🗄️  Updating database schema..."
    npx prisma db push
fi

# Sync JSON data to database
echo "🔄 Syncing JSON data to database..."
npm run sync

# Parse bib URLs if needed
if [ ! -f "public/data/ref-urls.json" ]; then
    echo "📚 Parsing bibliography URLs..."
    node scripts/parse-bib-urls.js
    mkdir -p public/data
    cp data/ref-urls.json public/data/ref-urls.json 2>/dev/null || true
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting development server..."
echo "📝 Open http://localhost:3000 in your browser"
echo ""

# Start the development server
npm run dev

