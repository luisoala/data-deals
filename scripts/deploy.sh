#!/bin/bash
set -e

echo "Starting deployment..."

# Navigate to project directory
cd /home/ubuntu/data-deals || exit 1

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Install dependencies
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma db push

# Sync JSON data to database
echo "Syncing JSON data to database..."
npm run sync

# Build Next.js app
echo "Building Next.js app..."
npm run build

# Restart PM2 process
echo "Restarting application..."
pm2 restart data-deals || pm2 start npm --name "data-deals" -- start

echo "Deployment complete!"

