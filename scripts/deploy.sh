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
echo "Available env vars: DOMAIN_NAME=${DOMAIN_NAME:-<not set>}, EC2_HOST=${EC2_HOST:-<not set>}, BASE_PATH=${BASE_PATH:-/neurips2025-data-deals}"

# Set base path (default to /neurips2025-data-deals)
BASE_PATH="${BASE_PATH:-/neurips2025-data-deals}"

if [ -f ".env" ]; then
  NEXTAUTH_URL=$(grep '^NEXTAUTH_URL=' .env | cut -d'"' -f2 || echo "")
  
  # Determine what it SHOULD be - try multiple sources
  EXPECTED_URL=""
  
  if [ -n "${DOMAIN_NAME:-}" ]; then
    EXPECTED_URL="https://$DOMAIN_NAME$BASE_PATH"
    echo "Using DOMAIN_NAME with base path: $EXPECTED_URL"
  elif [ -n "${EC2_HOST:-}" ]; then
    EXPECTED_URL="http://$EC2_HOST$BASE_PATH"
    echo "Using EC2_HOST with base path: $EXPECTED_URL"
  else
    # Try to get IP from metadata service
    echo "Trying to get EC2 IP from metadata service..."
    EC2_IP=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    if [ -n "$EC2_IP" ]; then
      EXPECTED_URL="http://$EC2_IP$BASE_PATH"
      echo "Using metadata service IP with base path: $EXPECTED_URL"
    else
      echo "WARNING: Could not determine EC2 IP. EC2_HOST secret may not be set."
    fi
  fi
  
  # Check if invalid (empty, localhost, or doesn't match expected)
  if [ -z "$NEXTAUTH_URL" ] || \
     [ "$NEXTAUTH_URL" = "localhost:3000" ] || \
     [ "$NEXTAUTH_URL" = "http://localhost:3000" ]; then
    if [ -n "$EXPECTED_URL" ]; then
      echo "Fixing NEXTAUTH_URL: $NEXTAUTH_URL -> $EXPECTED_URL"
      sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"$EXPECTED_URL\"|" .env
      echo "✓ Updated NEXTAUTH_URL to: $EXPECTED_URL"
    else
      echo "ERROR: NEXTAUTH_URL is not set correctly and cannot be auto-fixed!"
      echo "Current value: $NEXTAUTH_URL"
      echo "Please ensure DOMAIN_NAME or EC2_HOST secret is set in GitHub Actions."
      echo "The EC2_HOST secret should contain the IP address or hostname of your EC2 instance."
      exit 1
    fi
  elif [ -n "$EXPECTED_URL" ] && [ "$NEXTAUTH_URL" != "$EXPECTED_URL" ]; then
    echo "Updating NEXTAUTH_URL to match expected: $NEXTAUTH_URL -> $EXPECTED_URL"
    sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"$EXPECTED_URL\"|" .env
    echo "✓ Updated NEXTAUTH_URL to: $EXPECTED_URL"
  else
    echo "✓ NEXTAUTH_URL is set to: $NEXTAUTH_URL"
  fi
else
  echo "ERROR: .env file not found!"
  echo "This should have been created by the bootstrap script."
  exit 1
fi

# Update Nginx configuration with base path
echo "Updating Nginx configuration..."
BASE_PATH="${BASE_PATH:-/neurips2025-data-deals}"
DOMAIN_NAME="${DOMAIN_NAME:-}"

# Update Nginx config if domain is set
if [ -n "$DOMAIN_NAME" ]; then
  echo "Configuring Nginx for domain $DOMAIN_NAME with base path $BASE_PATH"
  
  # Check if SSL certificate exists
  SSL_CERT="/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem"
  SSL_KEY="/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem"
  
  if [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; then
    echo "SSL certificate found, configuring HTTPS..."
    sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

    # Handle the path prefix
    location $BASE_PATH {
        rewrite ^$BASE_PATH/?(.*) /\$1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location = / {
        return 301 $BASE_PATH;
    }
}

server {
    listen 80;
    server_name $DOMAIN_NAME;
    return 301 https://\$server_name\$request_uri;
}
EOF
  else
    echo "SSL certificate not found, configuring HTTP only..."
    sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location $BASE_PATH {
        rewrite ^$BASE_PATH/?(.*) /\$1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location = / {
        return 301 $BASE_PATH;
    }
}
EOF
  fi
  
  # Test and reload Nginx
  sudo nginx -t && sudo systemctl reload nginx
  echo "✓ Nginx configuration updated"
else
  echo "DOMAIN_NAME not set, skipping Nginx update (using existing config)"
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

# Verify .env file exists and has required variables
if [ -f ".env" ]; then
  echo "Verifying .env file contents..."
  
  # Debug: Check if environment variables are available
  echo "Checking environment variables from GitHub Actions:"
  echo "  OAUTH_CLIENT_ID is ${OAUTH_CLIENT_ID:+set (length: ${#OAUTH_CLIENT_ID})}${OAUTH_CLIENT_ID:-<not set>}"
  echo "  OAUTH_CLIENT_SECRET is ${OAUTH_CLIENT_SECRET:+set (length: ${#OAUTH_CLIENT_SECRET})}${OAUTH_CLIENT_SECRET:-<not set>}"
  echo "  ADMIN_GITHUB_USERNAMES is ${ADMIN_GITHUB_USERNAMES:+set}${ADMIN_GITHUB_USERNAMES:-<not set>}"
  
  # Update .env file with environment variables from GitHub Actions if they're available
  # This ensures secrets are written to .env file for PM2 to use
  if [ -n "${OAUTH_CLIENT_ID:-}" ]; then
    if grep -q "^GITHUB_CLIENT_ID=" .env; then
      # Update existing value
      sed -i "s|^GITHUB_CLIENT_ID=.*|GITHUB_CLIENT_ID=\"$OAUTH_CLIENT_ID\"|" .env
      echo "✓ Updated GITHUB_CLIENT_ID in .env"
    else
      # Add new line
      echo "GITHUB_CLIENT_ID=\"$OAUTH_CLIENT_ID\"" >> .env
      echo "✓ Added GITHUB_CLIENT_ID to .env"
    fi
  fi
  
  if [ -n "${OAUTH_CLIENT_SECRET:-}" ]; then
    if grep -q "^GITHUB_CLIENT_SECRET=" .env; then
      sed -i "s|^GITHUB_CLIENT_SECRET=.*|GITHUB_CLIENT_SECRET=\"$OAUTH_CLIENT_SECRET\"|" .env
      echo "✓ Updated GITHUB_CLIENT_SECRET in .env"
    else
      echo "GITHUB_CLIENT_SECRET=\"$OAUTH_CLIENT_SECRET\"" >> .env
      echo "✓ Added GITHUB_CLIENT_SECRET to .env"
    fi
  fi
  
  if [ -n "${ADMIN_GITHUB_USERNAMES:-}" ]; then
    if grep -q "^ADMIN_GITHUB_USERNAMES=" .env; then
      sed -i "s|^ADMIN_GITHUB_USERNAMES=.*|ADMIN_GITHUB_USERNAMES=\"$ADMIN_GITHUB_USERNAMES\"|" .env
      echo "✓ Updated ADMIN_GITHUB_USERNAMES in .env"
    else
      echo "ADMIN_GITHUB_USERNAMES=\"$ADMIN_GITHUB_USERNAMES\"" >> .env
      echo "✓ Added ADMIN_GITHUB_USERNAMES to .env"
    fi
  fi
  
  if [ -n "${NEXTAUTH_SECRET:-}" ]; then
    if grep -q "^NEXTAUTH_SECRET=" .env; then
      sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" .env
      echo "✓ Updated NEXTAUTH_SECRET in .env"
    else
      echo "NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"" >> .env
      echo "✓ Added NEXTAUTH_SECRET to .env"
    fi
  fi
  
  if grep -q "NEXTAUTH_URL=" .env && grep -q "GITHUB_CLIENT_ID=" .env; then
    echo "✓ .env file contains required variables"
    # Show NEXTAUTH_URL (masked) for debugging
    NEXTAUTH_URL=$(grep '^NEXTAUTH_URL=' .env | cut -d'"' -f2)
    echo "  NEXTAUTH_URL is set to: ${NEXTAUTH_URL:0:20}..."
  else
    echo "WARNING: .env file missing required variables!"
  fi
else
  echo "ERROR: .env file not found!"
  exit 1
fi

# Load environment variables from .env file and pass to PM2
# Next.js needs these at runtime, so we'll load them explicitly
echo "Loading environment variables from .env file..."

# Parse .env file and extract values (handles quoted and unquoted values)
parse_env_value() {
  local line="$1"
  # Remove comments and empty lines
  line=$(echo "$line" | sed 's/#.*$//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
  if [ -z "$line" ] || ! echo "$line" | grep -q '='; then
    echo ""
    return
  fi
  # Extract value after =, removing quotes if present
  # First try quoted value, then unquoted
  if echo "$line" | grep -q '=".*"'; then
    echo "$line" | sed -n 's/^[^=]*="\(.*\)"$/\1/p'
  else
    echo "$line" | sed -n 's/^[^=]*=\(.*\)$/\1/p'
  fi
}

# Extract values from .env file
ENV_DATABASE_URL=$(parse_env_value "$(grep '^DATABASE_URL=' .env | head -1)" || echo "file:./prisma/prod.db")
ENV_NEXTAUTH_URL=$(parse_env_value "$(grep '^NEXTAUTH_URL=' .env | head -1)" || echo "")
ENV_NEXTAUTH_SECRET=$(parse_env_value "$(grep '^NEXTAUTH_SECRET=' .env | head -1)" || echo "")
ENV_GITHUB_CLIENT_ID=$(parse_env_value "$(grep '^GITHUB_CLIENT_ID=' .env | head -1)" || echo "")
ENV_GITHUB_CLIENT_SECRET=$(parse_env_value "$(grep '^GITHUB_CLIENT_SECRET=' .env | head -1)" || echo "")
ENV_ADMIN_GITHUB_USERNAMES=$(parse_env_value "$(grep '^ADMIN_GITHUB_USERNAMES=' .env | head -1)" || echo "")
ENV_BASE_PATH="${BASE_PATH:-/neurips2025-data-deals}"

# Escape JSON special characters
escape_json() {
  echo "$1" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/\$/\\$/g'
}

# Create PM2 ecosystem file with explicit environment variables
# This ensures PM2 passes them to the Node.js process
# Use project directory so PM2 can find it reliably
ECOSYSTEM_FILE="$(pwd)/ecosystem.config.json"
cat > "$ECOSYSTEM_FILE" <<EOF
{
  "apps": [{
    "name": "data-deals",
    "script": "npm",
    "args": "start",
    "cwd": "$(pwd)",
    "env": {
      "NODE_ENV": "production",
      "DATABASE_URL": "$(escape_json "$ENV_DATABASE_URL")",
      "NEXTAUTH_URL": "$(escape_json "$ENV_NEXTAUTH_URL")",
      "NEXTAUTH_SECRET": "$(escape_json "$ENV_NEXTAUTH_SECRET")",
      "GITHUB_CLIENT_ID": "$(escape_json "$ENV_GITHUB_CLIENT_ID")",
      "GITHUB_CLIENT_SECRET": "$(escape_json "$ENV_GITHUB_CLIENT_SECRET")",
      "ADMIN_GITHUB_USERNAMES": "$(escape_json "$ENV_ADMIN_GITHUB_USERNAMES")",
      "BASE_PATH": "$(escape_json "$ENV_BASE_PATH")"
    }
  }]
}
EOF

echo "Environment variables loaded:"
echo "  NEXTAUTH_URL=${ENV_NEXTAUTH_URL:0:30}..."
echo "  GITHUB_CLIENT_ID=${ENV_GITHUB_CLIENT_ID:0:10}..."
echo "  GITHUB_CLIENT_SECRET=${ENV_GITHUB_CLIENT_SECRET:0:10}..."

# Debug: Show ecosystem file contents (masked)
echo "PM2 ecosystem file contents (masked):"
cat "$ECOSYSTEM_FILE" | sed 's/"GITHUB_CLIENT_ID": "[^"]*"/"GITHUB_CLIENT_ID": "***"/' | sed 's/"GITHUB_CLIENT_SECRET": "[^"]*"/"GITHUB_CLIENT_SECRET": "***"/' | head -15

echo "Starting PM2 with environment variables..."
# Delete existing process first
pm2 delete data-deals 2>/dev/null || true
# Start with ecosystem file (use relative path from project directory)
cd "$(pwd)"
pm2 start ecosystem.config.json
pm2 save
# Keep ecosystem file for future restarts (don't delete it)

# Verify environment variables are set in PM2
echo "Verifying PM2 environment..."
sleep 2
pm2 env 0 | grep -E "(NEXTAUTH_URL|GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET)" || {
  echo "WARNING: Environment variables not found in PM2 env!"
  echo "Checking PM2 process info..."
  pm2 describe data-deals | grep -A 20 "env:" || true
}

# Verify NEXTAUTH_URL is accessible to the running process
echo "Verifying environment variables are loaded..."
sleep 2
pm2 logs data-deals --lines 20 --nostream | grep -i "nextauth" || echo "Note: Check PM2 logs if authentication fails"

echo "Deployment complete!"

