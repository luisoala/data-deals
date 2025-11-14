# Automated Deployment Plan: GitHub Actions → EC2

## Current State

✅ **Already Exists:**
- GitHub Actions workflow file: `.github/workflows/deploy.yml`
- Deployment script: `scripts/deploy.sh`
- EC2 setup script: `scripts/setup-ec2.sh`

⚠️ **Needs Setup:**
- GitHub Secrets configuration
- EC2 instance provisioning and initial setup
- SSH key pair generation and configuration
- Environment variables on EC2
- First-time repository clone on EC2

## Plan Overview

### Phase 1: EC2 Instance Setup
1. Launch EC2 instance
2. Configure security groups
3. Generate SSH key pair
4. Run initial setup script
5. Clone repository
6. Configure environment variables

### Phase 2: GitHub Secrets Configuration
1. Add required secrets to GitHub repository
2. Test SSH connection from GitHub Actions

### Phase 3: Workflow Improvements
1. Update workflow to use latest actions
2. Add error handling and notifications
3. Test automated deployment

## Detailed Steps

### Phase 1: EC2 Instance Provisioning

#### Step 1.1: Launch EC2 Instance

**Requirements:**
- **AMI**: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS
- **Instance Type**: t3.small or t3.medium (minimum 2GB RAM for Next.js builds)
- **Storage**: 20GB minimum (for Node modules, builds, database)
- **Security Group**: Allow SSH (port 22) from your IP, HTTP (port 80) from anywhere, HTTPS (port 443) from anywhere

**AWS Console Steps:**
1. Go to EC2 → Launch Instance
2. Choose Ubuntu Server 22.04 LTS or 24.04 LTS
3. Select instance type (t3.small recommended)
4. Create or select key pair (save private key securely)
5. Configure security group:
   - SSH (22): Your IP only
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0 (if using SSL)
6. Launch instance
7. Note the public IP address

#### Step 1.2: Generate SSH Key Pair (if not done)

**Option A: Use AWS Key Pair**
- Download `.pem` file from AWS
- Convert to format GitHub Actions can use:
  ```bash
  # Convert .pem to private key format
  chmod 400 your-key.pem
  # Copy the entire content (including BEGIN/END lines) for GitHub secret
  ```

**Option B: Generate New Key Pair**
```bash
# Generate new SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/data-deals-deploy

# Copy public key to EC2
ssh-copy-id -i ~/.ssh/data-deals-deploy.pub ubuntu@<EC2_IP>

# The private key (~/.ssh/data-deals-deploy) goes to GitHub Secrets
```

#### Step 1.3: Initial EC2 Setup

**SSH into EC2:**
```bash
ssh -i your-key.pem ubuntu@<EC2_IP>
```

**Run setup script:**
```bash
# Clone repository (if not already done)
cd /home/ubuntu
git clone <your-repo-url> data-deals
cd data-deals

# Run EC2 setup script
bash scripts/setup-ec2.sh
```

**Manual steps after setup script:**
```bash
# Navigate to app directory
cd /home/ubuntu/data-deals

# Create .env file
nano .env
```

**Required .env variables:**
```bash
# Database (use PostgreSQL for production, or SQLite for simple setup)
DATABASE_URL="file:./prisma/prod.db"  # SQLite
# OR for PostgreSQL:
# DATABASE_URL="postgresql://user:password@localhost:5432/data_deals"

# NextAuth
NEXTAUTH_URL="http://<EC2_IP>"  # Or your domain
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"

# GitHub OAuth
GITHUB_CLIENT_ID="<your-github-oauth-client-id>"
GITHUB_CLIENT_SECRET="<your-github-oauth-client-secret>"

# Admin Access
ADMIN_GITHUB_USERNAMES="your-github-username,other-admin-username"
```

**First-time setup:**
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Set up database
npx prisma db push

# Sync data
npm run sync

# Build application
npm run build

# Start with PM2
pm2 start npm --name "data-deals" -- start

# Save PM2 configuration
pm2 save
```

**Verify setup:**
```bash
# Check PM2 status
pm2 list

# Check Nginx status
sudo systemctl status nginx

# Test application
curl http://localhost:3000
```

#### Step 1.4: Configure Git for Automated Pulls

**Set up Git credentials (if using private repo):**
```bash
# Option 1: Use deploy key (recommended)
# Generate deploy key on EC2
ssh-keygen -t ed25519 -C "ec2-deploy-key" -f ~/.ssh/deploy-key

# Add public key to GitHub repo → Settings → Deploy keys
cat ~/.ssh/deploy-key.pub

# Configure Git to use deploy key
cd /home/ubuntu/data-deals
git config core.sshCommand "ssh -i ~/.ssh/deploy-key -F /dev/null"

# Option 2: Use GitHub token (alternative)
git config --global credential.helper store
# Then use: https://<token>@github.com/username/repo.git
```

### Phase 2: GitHub Secrets Configuration

#### Step 2.1: Access GitHub Repository Settings

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

#### Step 2.2: Add Required Secrets

**Secret 1: `EC2_HOST`**
- **Value**: EC2 instance public IP or domain name
- **Example**: `54.123.45.67` or `data-deals.example.com`

**Secret 2: `EC2_USER`**
- **Value**: SSH username (usually `ubuntu` for Ubuntu AMIs)
- **Example**: `ubuntu`

**Secret 3: `EC2_SSH_KEY`**
- **Value**: Complete private SSH key content
- **Format**: Include entire key including:
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  <key content>
  -----END OPENSSH PRIVATE KEY-----
  ```
- **How to get**: 
  ```bash
  # If using AWS key pair:
  cat your-key.pem
  
  # If using generated key:
  cat ~/.ssh/data-deals-deploy
  ```

#### Step 2.3: Verify Secrets

1. Go to **Actions** tab in GitHub
2. Manually trigger workflow (if needed) or push to `main`
3. Check workflow logs for SSH connection success

### Phase 3: Workflow Improvements

#### Current Workflow Issues:
- Uses outdated action versions (`@v3`, `@v1.0.0`)
- No error handling or rollback
- No deployment notifications
- Doesn't use existing `deploy.sh` script

#### Improved Workflow

**File**: `.github/workflows/deploy.yml`

**Improvements to make:**
1. Update to latest action versions
2. Use `deploy.sh` script instead of inline commands
3. Add deployment status notifications
4. Add rollback capability
5. Add health check after deployment

## Implementation Checklist

### EC2 Setup
- [ ] Launch EC2 instance (Ubuntu 22.04/24.04)
- [ ] Configure security groups (SSH, HTTP, HTTPS)
- [ ] Generate/download SSH key pair
- [ ] SSH into instance
- [ ] Run `scripts/setup-ec2.sh`
- [ ] Clone repository to `/home/ubuntu/data-deals`
- [ ] Create `.env` file with all required variables
- [ ] Run first-time setup (npm install, prisma, sync, build)
- [ ] Start PM2 process
- [ ] Verify application is accessible
- [ ] Configure Git for automated pulls (deploy key or token)

### GitHub Configuration
- [ ] Add `EC2_HOST` secret
- [ ] Add `EC2_USER` secret
- [ ] Add `EC2_SSH_KEY` secret
- [ ] Test workflow manually or push to main
- [ ] Verify deployment succeeds

### Workflow Improvements
- [ ] Update workflow file with latest action versions
- [ ] Refactor to use `deploy.sh` script
- [ ] Add error handling
- [ ] Add deployment notifications (optional)
- [ ] Test complete deployment flow

## Quick Reference Commands

### On EC2 Instance

**Check application status:**
```bash
pm2 list
pm2 logs data-deals
```

**Manual deployment (if needed):**
```bash
cd /home/ubuntu/data-deals
bash scripts/deploy.sh
```

**Restart application:**
```bash
pm2 restart data-deals
```

**Check Nginx:**
```bash
sudo systemctl status nginx
sudo nginx -t
sudo systemctl restart nginx
```

**View logs:**
```bash
# PM2 logs
pm2 logs data-deals

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Application logs (if any)
cd /home/ubuntu/data-deals
pm2 logs
```

### GitHub Actions

**Manually trigger workflow:**
- Go to Actions tab
- Select "Deploy to EC2" workflow
- Click "Run workflow"
- Select branch (main)
- Click "Run workflow"

## Troubleshooting

### SSH Connection Fails
- Verify `EC2_HOST` is correct (IP or domain)
- Verify `EC2_USER` is correct (usually `ubuntu`)
- Verify `EC2_SSH_KEY` includes full key with headers
- Check EC2 security group allows SSH from GitHub Actions IPs
- Test SSH manually: `ssh -i key.pem ubuntu@<EC2_IP>`

### Deployment Fails
- Check workflow logs in GitHub Actions
- SSH into EC2 and check PM2 logs: `pm2 logs data-deals`
- Verify `.env` file exists and has all variables
- Check database connection
- Verify Node.js version matches (should be 20+)

### Application Not Accessible
- Check PM2 status: `pm2 list`
- Check Nginx status: `sudo systemctl status nginx`
- Verify Nginx config: `sudo nginx -t`
- Check firewall: `sudo ufw status`
- Test locally on EC2: `curl http://localhost:3000`

## Security Considerations

1. **SSH Key Security**
   - Never commit private keys to repository
   - Use GitHub Secrets for all sensitive data
   - Rotate keys periodically

2. **EC2 Security**
   - Restrict SSH access to specific IPs in security group
   - Use IAM roles instead of access keys when possible
   - Keep system updated: `sudo apt update && sudo apt upgrade`

3. **Environment Variables**
   - Never commit `.env` file
   - Use strong `NEXTAUTH_SECRET`
   - Rotate secrets periodically

4. **Database Security**
   - Use PostgreSQL with strong passwords in production
   - Restrict database access to localhost only
   - Regular backups

## Next Steps After Setup

1. **Set up domain name** (optional)
   - Point DNS to EC2 IP
   - Update `NEXTAUTH_URL` in `.env`
   - Configure SSL with Let's Encrypt

2. **Set up monitoring** (optional)
   - PM2 monitoring: `pm2 install pm2-logrotate`
   - Set up CloudWatch or similar
   - Configure alerts for failures

3. **Set up backups** (optional)
   - Database backups
   - Application state backups
   - Automated backup schedule

4. **Set up staging environment** (optional)
   - Separate EC2 instance for staging
   - Deploy to staging on PR merge
   - Deploy to production on main merge

