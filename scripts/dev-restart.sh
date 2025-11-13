#!/bin/bash
set -e

echo "🔄 Restarting Data Deals development environment..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Kill any existing Next.js dev server
echo "🛑 Stopping existing dev server..."
pkill -f "next dev" || true
sleep 1

# Quick sync of data
echo "🔄 Syncing JSON data to database..."
npm run sync

# Start the development server
echo ""
echo "✅ Restarting development server..."
echo "📝 Open http://localhost:3000 in your browser"
echo ""

npm run dev

