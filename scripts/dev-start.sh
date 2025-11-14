#!/bin/bash
set -e

echo "Starting Data Deals development environment..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "WARNING: .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Created .env file. Please edit it with your configuration."
    else
        echo "ERROR: .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "Updating npm packages..."
    npm install
fi

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Check if database exists, if not create it
if [ ! -f "prisma/dev.db" ]; then
    echo "Creating database..."
    npx prisma db push
else
    echo "Updating database schema..."
    npx prisma db push
fi

# Sync JSON data to database
echo "Syncing JSON data to database..."
npm run sync

echo ""
echo "Setup complete!"
echo ""
echo "Starting development server..."
echo "Open http://localhost:3000 in your browser"
echo ""

# Start the development server
npm run dev

