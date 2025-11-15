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

# Install certbot if domain is set and certbot is not available
if [ -n "$DOMAIN_NAME" ] && ! command -v certbot &> /dev/null; then
  echo "Installing certbot for SSL certificate management..."
  sudo apt-get update -qq
  sudo apt-get install -y certbot python3-certbot-nginx
fi

# Update Nginx config if domain is set
if [ -n "$DOMAIN_NAME" ]; then
  echo "Configuring Nginx for domain $DOMAIN_NAME with base path $BASE_PATH"
  
  # Check if SSL certificate exists
  SSL_CERT="/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem"
  SSL_KEY="/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem"
  
  if [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; then
    echo "SSL certificate found, configuring HTTPS..."
    # Get EC2 IP for fallback server block
    EC2_IP="${EC2_HOST:-}"
    if [ -z "$EC2_IP" ]; then
      EC2_IP=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    fi
    
    # Always write the full config with base path (certbot may have modified it)
    sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
# HTTPS server block for domain
server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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

# HTTP redirect to HTTPS for domain
server {
    listen 80;
    server_name $DOMAIN_NAME;
    return 301 https://\$server_name\$request_uri;
}

# IP-based server block (fallback for direct IP access - HTTP only)
server {
    listen 80 default_server;
    server_name _ ${EC2_IP};

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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
  else
    echo "SSL certificate not found, configuring HTTP only..."
    # Get EC2 IP for fallback server block
    EC2_IP="${EC2_HOST:-}"
    if [ -z "$EC2_IP" ]; then
      EC2_IP=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    fi
    
    sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
# Domain-based server block
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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

# IP-based server block (fallback for direct IP access)
server {
    listen 80 default_server;
    server_name _ ${EC2_IP};

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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
    
    # Test and reload Nginx before trying to get SSL cert
    sudo nginx -t && sudo systemctl reload nginx
    
    # Try to obtain SSL certificate if certbot is available
    if command -v certbot &> /dev/null; then
      echo "Attempting to obtain SSL certificate for $DOMAIN_NAME..."
      CERTBOT_EMAIL_VAL="${CERTBOT_EMAIL:-admin@$DOMAIN_NAME}"
      
      # Wait a moment for Nginx to be fully ready
      sleep 2
      
      # Run certbot to obtain/renew certificate
      # Certbot will modify Nginx config, so we need to re-apply base path after
      sudo certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --email "$CERTBOT_EMAIL_VAL" --redirect 2>&1 | tee /tmp/certbot-output.log || {
        echo "SSL certificate setup failed. Checking certbot output..."
        tail -30 /tmp/certbot-output.log || echo "Could not read certbot output"
        echo "You can manually run: sudo certbot --nginx -d $DOMAIN_NAME"
        echo "Make sure DNS is pointing to this server and ports 80/443 are open."
      }
      
      # Wait a moment for certbot to finish writing files and modifying config
      sleep 3
      
      # Certbot ALWAYS modifies Nginx config when it runs (even for renewals)
      # We MUST re-apply base path configuration after certbot runs
      echo "Re-applying base path configuration after certbot (certbot always overwrites config)..."
      
      # Get EC2 IP for fallback server block
      EC2_IP="${EC2_HOST:-}"
      if [ -z "$EC2_IP" ]; then
        EC2_IP=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
      fi
      
      # Check if certificate exists using sudo (files are root-owned)
      # Also check certbot output log for success indicators
      CERTBOT_SUCCESS=false
      if grep -q "Successfully deployed certificate" /tmp/certbot-output.log 2>/dev/null || \
         grep -q "Certificate not yet due for renewal" /tmp/certbot-output.log 2>/dev/null; then
        CERTBOT_SUCCESS=true
      fi
      
      # Check if certificate files exist (use sudo since they're root-owned)
      if sudo test -f "$SSL_CERT" && sudo test -f "$SSL_KEY"; then
        echo "✓ SSL certificate files found at $SSL_CERT"
        echo "✓ SSL certificate found, configuring HTTPS with base path..."
        
        # Re-apply the HTTPS config with base path
        sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
# HTTPS server block for domain
server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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

# HTTP redirect to HTTPS for domain
server {
    listen 80;
    server_name $DOMAIN_NAME;
    return 301 https://\$server_name\$request_uri;
}

# IP-based server block (fallback for direct IP access - HTTP only)
server {
    listen 80 default_server;
    server_name _ ${EC2_IP};

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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
        
        # Test and reload Nginx with corrected config
        sudo nginx -t && sudo systemctl reload nginx
        echo "✓ Base path configuration restored after certbot (HTTPS)"
      elif [ "$CERTBOT_SUCCESS" = "true" ]; then
        echo "Certbot succeeded but certificate files check failed. Checking certificate path..."
        echo "  SSL_CERT path: $SSL_CERT"
        echo "  SSL_KEY path: $SSL_KEY"
        sudo ls -la "$SSL_CERT" "$SSL_KEY" 2>&1 || true
        echo "Applying HTTPS config anyway (certbot reported success)..."
        
        # Apply HTTPS config assuming certbot created the files
        sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
# HTTPS server block for domain
server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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

# HTTP redirect to HTTPS for domain
server {
    listen 80;
    server_name $DOMAIN_NAME;
    return 301 https://\$server_name\$request_uri;
}

# IP-based server block (fallback for direct IP access - HTTP only)
server {
    listen 80 default_server;
    server_name _ ${EC2_IP};

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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
        sudo nginx -t && sudo systemctl reload nginx
        echo "✓ Base path configuration restored after certbot (HTTPS - certbot success fallback)"
      else
        echo "SSL certificate files not found and certbot did not report success. Re-applying HTTP config with base path..."
        # Even if cert check fails, certbot may have modified config, so re-apply HTTP config
        sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
# Domain-based server block
server {
    listen 80;
    server_name $DOMAIN_NAME;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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

# IP-based server block (fallback for direct IP access)
server {
    listen 80 default_server;
    server_name _ ${EC2_IP};

    # Handle the path prefix (matches base path and all sub-paths including _next/static)
    # Let Next.js handle the base path internally - don't rewrite
    location ~ ^$BASE_PATH {
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
        sudo nginx -t && sudo systemctl reload nginx
        echo "✓ Base path configuration restored after certbot (HTTP)"
      fi
    else
      echo "WARNING: Certbot not available. SSL certificate cannot be obtained."
      echo "Install certbot manually: sudo apt-get install -y certbot python3-certbot-nginx"
    fi
  fi
  
  # Test and reload Nginx (if SSL cert was obtained, this ensures HTTPS config is active)
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
# Export BASE_PATH so Next.js can use it during build (next.config.js reads process.env.BASE_PATH)
export BASE_PATH="${BASE_PATH:-/neurips2025-data-deals}"
echo "Building with BASE_PATH=${BASE_PATH}"
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

