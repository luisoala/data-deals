#!/bin/bash
set -e

echo "Starting deployment..."

# Navigate to project directory
cd /home/ubuntu/data-deals || exit 1

# CRITICAL: Export database to deals.json BEFORE git pull
# This preserves any approved suggestions that were added on production
echo "Exporting database to deals.json (preserving production changes)..."
npm run export:db || echo "WARNING: Database export failed (may be first deploy)"

# Backup current deals.json if it exists
if [ -f "data/deals.json" ]; then
  cp data/deals.json data/deals.json.backup
  echo "Backed up deals.json"
fi

# Pull latest changes (this will overwrite deals.json with repo version)
echo "Pulling latest changes..."
git pull origin main || {
  echo "WARNING: git pull failed, continuing with existing code"
}

# Merge production deals.json with repo deals.json
# If we exported from DB, use that; otherwise use backup
if [ -f "data/deals.json.backup" ]; then
  echo "Merging production changes with repo version..."
  # Use Node.js to merge: prefer production IDs, but add new ones from repo
  node -e "
    const fs = require('fs');
    const prod = JSON.parse(fs.readFileSync('data/deals.json.backup', 'utf-8'));
    const repo = JSON.parse(fs.readFileSync('data/deals.json', 'utf-8'));
    
    // Create map of production deals by ref (most reliable identifier)
    const prodMap = new Map();
    prod.forEach(d => prodMap.set(d.ref, d));
    
    // Merge: production deals take precedence, add new ones from repo
    const merged = [];
    const seenRefs = new Set();
    
    // First, add all production deals
    prod.forEach(d => {
      merged.push(d);
      seenRefs.add(d.ref);
    });
    
    // Then, add repo deals that don't exist in production
    repo.forEach(d => {
      if (!seenRefs.has(d.ref)) {
        // Find max ID and assign new one
        const maxId = Math.max(...merged.map(m => m.id), 0);
        merged.push({ ...d, id: maxId + 1 });
        seenRefs.add(d.ref);
      }
    });
    
    // Sort by ID
    merged.sort((a, b) => a.id - b.id);
    
    fs.writeFileSync('data/deals.json', JSON.stringify(merged, null, 2));
    console.log(\`Merged: \${prod.length} production deals + \${repo.length - prod.length} new from repo = \${merged.length} total\`);
  " || echo "WARNING: Merge failed, using repo version"
  
  rm -f data/deals.json.backup
fi

# Verify NEXTAUTH_URL is set correctly before proceeding
echo "Verifying NEXTAUTH_URL configuration..."
if [ -f ".env" ]; then
  NEXTAUTH_URL=$(grep '^NEXTAUTH_URL=' .env | cut -d'"' -f2 || echo "")
  if [ -z "$NEXTAUTH_URL" ] || [ "$NEXTAUTH_URL" = "localhost:3000" ] || [ "$NEXTAUTH_URL" = "http://localhost:3000" ]; then
    echo "ERROR: NEXTAUTH_URL is not set correctly in .env file!"
    echo "Current value: $NEXTAUTH_URL"
    echo "This will cause authentication to fail."
    echo "Please ensure DOMAIN_NAME or EC2_HOST secret is set in GitHub Actions."
    exit 1
  else
    echo "✓ NEXTAUTH_URL is set to: $NEXTAUTH_URL"
  fi
else
  echo "ERROR: .env file not found!"
  echo "This should have been created by the bootstrap script."
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma db push

# Sync JSON data to database (now with merged deals.json)
echo "Syncing JSON data to database..."
npm run sync

# Commit and push production changes back to repo
echo "Committing production changes to repo..."
if [ -f "data/deals.json" ]; then
  # Configure git if not already configured
  git config user.name "EC2 Production Deploy" || true
  git config user.email "deploy@data-deals.local" || true
  
  # Check if there are changes to commit
  if git diff --quiet data/deals.json; then
    echo "No changes to commit in deals.json"
  else
    # Stage deals.json
    git add data/deals.json
    
    # Commit with descriptive message
    git commit -m "Auto-commit: Sync production deals.json from approved suggestions
    
    - Merged production changes with repo version
    - Preserves approved suggestions from production
    - Auto-committed by deploy script on $(hostname)
    - Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" || {
      echo "WARNING: Commit failed (may be no changes or git issue)"
    }
    
    # Push to main branch
    # Use GITHUB_TOKEN if available, otherwise try SSH
    if [ -n "${GITHUB_TOKEN:-}" ]; then
      echo "Pushing using GITHUB_TOKEN..."
      # Extract repo from remote URL or use GITHUB_REPOSITORY env var
      REPO_URL=$(git config --get remote.origin.url)
      if [[ "$REPO_URL" == *"github.com"* ]]; then
        # Extract owner/repo from SSH or HTTPS URL
        REPO=$(echo "$REPO_URL" | sed -E 's|.*github.com[:/]([^/]+/[^/]+)(\.git)?$|\1|')
        git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO}.git" 2>/dev/null || true
      elif [ -n "${GITHUB_REPOSITORY:-}" ]; then
        git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" 2>/dev/null || true
      fi
      git push origin main || echo "WARNING: Push failed (check GITHUB_TOKEN permissions)"
    else
      echo "Pushing using SSH..."
      git push origin main || echo "WARNING: Push failed (may need git credentials or GITHUB_TOKEN secret configured)"
    fi
  fi
fi

# Build Next.js app
echo "Building Next.js app..."
npm run build

# Restart PM2 process (this will reload .env file)
echo "Restarting application..."
# Delete and recreate to ensure fresh environment variables
pm2 delete data-deals 2>/dev/null || true
# Start with explicit working directory to ensure .env is loaded
cd /home/ubuntu/data-deals
pm2 start npm --name "data-deals" -- start
pm2 save

# Verify NEXTAUTH_URL is accessible to the running process
echo "Verifying environment variables are loaded..."
sleep 2
pm2 logs data-deals --lines 20 --nostream | grep -i "nextauth" || echo "Note: Check PM2 logs if authentication fails"

echo "Deployment complete!"

