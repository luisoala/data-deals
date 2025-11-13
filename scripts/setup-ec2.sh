#!/bin/bash
# EC2 Setup Script
# Run this script on a fresh Ubuntu EC2 instance

set -e

echo "Setting up EC2 instance for Data Deals..."

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx

# Install Git
sudo apt-get install -y git

# Create application directory
mkdir -p /home/ubuntu/data-deals
cd /home/ubuntu/data-deals

# Clone repository (update with your repo URL)
# git clone <your-repo-url> .

# Set up Nginx configuration
sudo tee /etc/nginx/sites-available/data-deals > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
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
pm2 startup systemd
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "EC2 setup complete!"
echo "Next steps:"
echo "1. Clone your repository to /home/ubuntu/data-deals"
echo "2. Set up environment variables in .env file"
echo "3. Run: npm install && npx prisma generate && npx prisma db push && npm run sync"
echo "4. Run: npm run build"
echo "5. Run: pm2 start npm --name 'data-deals' -- start"
echo "6. Set up SSL with Let's Encrypt (optional): sudo certbot --nginx -d your-domain.com"

