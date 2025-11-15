#!/bin/bash
# Bootstrap script - Run this via GitHub Actions on a fresh EC2 instance
# This script handles first-time setup including cloning repo, installing dependencies, etc.

set -e

echo "Starting bootstrap process..."

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    echo "WARNING: This script should run as 'ubuntu' user"
fi

# Update system
echo "Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# Install Node.js 20 if not installed
if ! command -v node &> /dev/null || [ "$(node --version | cut -d'v' -f2 | cut -d'.' -f1)" -lt "20" ]; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
else
    echo "PM2 already installed"
fi

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt-get install -y nginx
else
    echo "Nginx already installed"
fi

# Install Git if not installed
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    sudo apt-get install -y git
else
    echo "Git already installed"
fi

# Create application directory
APP_DIR="/home/ubuntu/data-deals"
echo "Setting up application directory: $APP_DIR"
mkdir -p "$APP_DIR"

# Clone repository if it doesn't exist
if [ ! -d "$APP_DIR/.git" ]; then
    echo "Cloning repository..."
    cd /home/ubuntu
    # Repository URL will be passed as environment variable or we'll use the one from GitHub Actions
    REPO_URL="${GITHUB_REPOSITORY_URL:-https://github.com/$(whoami)/data-deals.git}"
    git clone "$REPO_URL" data-deals || {
        echo "WARNING: Repository clone failed. You may need to set up deploy key or use HTTPS with token."
        echo "Creating directory structure..."
        mkdir -p "$APP_DIR"
    }
else
    echo "Repository already cloned"
fi

cd "$APP_DIR"

# Set up Nginx configuration
echo "Configuring Nginx..."
BASE_PATH="${BASE_PATH:-/neurips2025-data-deals}"
DOMAIN_NAME="${DOMAIN_NAME:-}"

# Configure Nginx with path prefix support
sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME:-_};

    # Handle the path prefix - rewrite to remove prefix before proxying
    location ${BASE_PATH} {
        # Remove the base path prefix before proxying to Next.js
        rewrite ^${BASE_PATH}/?(.*) /\$1 break;
        
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

    # Optional: Redirect root to the app
    location = / {
        return 301 ${BASE_PATH};
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/data-deals /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# Set up PM2 to start on boot
echo "Configuring PM2..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu | grep -v "PM2" | sudo bash || true

# Create .env file if it doesn't exist
if [ ! -f "$APP_DIR/.env" ]; then
    echo "Creating .env file template..."
    cat > "$APP_DIR/.env" <<EOF
# Database
DATABASE_URL="file:./prisma/prod.db"

# NextAuth
# NEXTAUTH_URL must include /api/auth at the end for NextAuth to work correctly
BASE_PATH="${BASE_PATH:-/neurips2025-data-deals}"
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'localhost:3000')
NEXTAUTH_URL="http://$EC2_IP$BASE_PATH/api/auth"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# GitHub OAuth (set these manually)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Admin Access
ADMIN_GITHUB_USERNAMES=""
EOF
    echo "WARNING: .env file created with template. Please update with your actual values!"
else
    echo ".env file already exists"
fi

# Install dependencies
if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "Installing npm dependencies..."
    cd "$APP_DIR"
    npm install
else
    echo "Dependencies already installed"
fi

# Generate Prisma client
echo "Generating Prisma client..."
cd "$APP_DIR"
npx prisma generate || echo "WARNING: Prisma generate failed (may need .env configured)"

# Set up database
echo "Setting up database..."
cd "$APP_DIR"
npx prisma db push || echo "WARNING: Database setup failed (may need .env configured)"

# Sync data
echo "Syncing data..."
cd "$APP_DIR"
npm run sync || echo "WARNING: Data sync failed (may need database configured)"

# Build application
echo "Building application..."
cd "$APP_DIR"
npm run build || echo "WARNING: Build failed (may need environment configured)"

# Start with PM2
echo "Starting application with PM2..."
cd "$APP_DIR"
pm2 delete data-deals 2>/dev/null || true
pm2 start npm --name "data-deals" -- start || echo "WARNING: PM2 start failed"
pm2 save

echo ""
echo "Bootstrap complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your actual values:"
echo "   nano $APP_DIR/.env"
echo "2. Restart the application:"
echo "   pm2 restart data-deals"
echo "3. Check status:"
echo "   pm2 list"
echo "   pm2 logs data-deals"

