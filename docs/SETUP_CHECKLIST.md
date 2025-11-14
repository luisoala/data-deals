# Automated Deployment Setup Checklist

## Quick Setup Guide

Follow these steps in order to set up automated deployment from GitHub Actions to EC2.

## Prerequisites

- AWS account with EC2 access
- GitHub repository access
- SSH client installed locally

---

## Step 1: EC2 Instance Setup (5 minutes - NO MANUAL LOGIN NEEDED!)

### 1.1 Launch EC2 Instance
- [ ] Go to AWS Console → EC2 → Launch Instance
- [ ] Choose **Ubuntu Server 22.04 LTS** or **24.04 LTS**
- [ ] Select instance type: **t3.small** (minimum)
- [ ] Create new key pair or use existing
- [ ] **Download and save** the `.pem` file securely
- [ ] Configure security group:
  - [ ] SSH (port 22) - **0.0.0.0/0** (allows GitHub Actions to connect)
  - [ ] HTTP (port 80) - 0.0.0.0/0 (all)
  - [ ] HTTPS (port 443) - 0.0.0.0/0 (all, if using SSL)
- [ ] Launch instance
- [ ] **Note the Public IP address**

**That's it! No need to SSH in manually. GitHub Actions will handle everything!**

---

## Step 2: GitHub Secrets Configuration (5 minutes)

### 2.1 Access GitHub Secrets
- [ ] Go to your GitHub repository
- [ ] Navigate to **Settings** → **Secrets and variables** → **Actions**
- [ ] Click **New repository secret**

### 2.2 Add Required Secrets

**Secret 1: `EC2_HOST`**
- [ ] Name: `EC2_HOST`
- [ ] Value: Your EC2 public IP (e.g., `54.123.45.67`)
- [ ] Click **Add secret**

**Secret 2: `EC2_USER`**
- [ ] Name: `EC2_USER`
- [ ] Value: `ubuntu`
- [ ] Click **Add secret**

**Secret 3: `EC2_SSH_KEY`**
- [ ] Name: `EC2_SSH_KEY`
- [ ] Value: Complete private key content
  ```bash
  # On your local machine, get the key:
  cat your-key.pem
  # Copy ENTIRE output including:
  # -----BEGIN RSA PRIVATE KEY-----
  # ...key content...
  # -----END RSA PRIVATE KEY-----
  ```
- [ ] Click **Add secret**

**Optional Secrets (Recommended - Automates .env setup):**

**Secret 4: `OAUTH_CLIENT_ID`** (Optional but recommended)
- [ ] Name: `OAUTH_CLIENT_ID` ⚠️ Note: Cannot start with `GITHUB_`
- [ ] Value: Your GitHub OAuth app client ID
- [ ] Click **Add secret**

**Secret 5: `OAUTH_CLIENT_SECRET`** (Optional but recommended)
- [ ] Name: `OAUTH_CLIENT_SECRET` ⚠️ Note: Cannot start with `GITHUB_`
- [ ] Value: Your GitHub OAuth app client secret
- [ ] Click **Add secret**

**Secret 6: `ADMIN_GITHUB_USERNAMES`** (Optional but recommended)
- [ ] Name: `ADMIN_GITHUB_USERNAMES`
- [ ] Value: Comma-separated GitHub usernames (e.g., `username1,username2`)
- [ ] Click **Add secret**

**Secret 7: `NEXTAUTH_SECRET`** (Optional)
- [ ] Name: `NEXTAUTH_SECRET`
- [ ] Value: Generate with `openssl rand -base64 32`
- [ ] Click **Add secret**

**Secret 8: `EC2_SSH_PORT`** (Optional)
- [ ] Name: `EC2_SSH_PORT`
- [ ] Value: `22` (only if using non-standard port)
- [ ] Click **Add secret**

---

## Step 3: First Deployment & Configure .env (10 minutes)

### 3.1 Trigger First Deployment
- [ ] Go to GitHub repository → **Actions** tab
- [ ] Select **Deploy to EC2** workflow
- [ ] Click **Run workflow** → **Run workflow**
- [ ] Watch the workflow execute
- [ ] **The workflow will automatically:**
  - Install Node.js, PM2, Nginx
  - Upload your code to EC2
  - Create `.env` template file
  - Set up Nginx and PM2

### 3.2 Configure Environment Variables

**Option A: Using GitHub Secrets (Recommended - Fully Automated!)**
If you added the optional secrets in Step 2, the `.env` file will be automatically configured. Skip to 3.3!

**Option B: Manual Configuration (One-time SSH)**
If you didn't add the optional secrets, SSH in once to configure `.env`:

```bash
# SSH into EC2 (only needed once!)
ssh -i your-key.pem ubuntu@<EC2_IP>

# Edit .env file
nano /home/ubuntu/data-deals/.env
```

**Update these values:**
```bash
GITHUB_CLIENT_ID="<your-github-oauth-id>"
GITHUB_CLIENT_SECRET="<your-github-oauth-secret>"
ADMIN_GITHUB_USERNAMES="your-username"
```

**Save and exit** (Ctrl+X, then Y, then Enter)

### 3.3 Complete Setup
- [ ] Go to GitHub → **Actions** → **Deploy to EC2**
- [ ] Click **Run workflow** → **Run workflow**
- [ ] This will install dependencies, build, and start the app
- [ ] If you did manual config, this will preserve your `.env` file

### 3.4 Verify Deployment
- [ ] Check workflow logs for success
- [ ] Visit `http://<EC2_IP>` in browser
- [ ] Application should be running!

### 3.5 Test Automatic Deployment
- [ ] Make a small change (e.g., update README)
- [ ] Commit and push to `main` branch
- [ ] Verify workflow triggers automatically
- [ ] Verify deployment completes successfully
- [ ] **No more manual steps needed!**

---

## Troubleshooting

### Workflow Fails: SSH Connection
```bash
# Test SSH manually
ssh -i your-key.pem ubuntu@<EC2_IP>

# Verify secrets are correct
# Check EC2 security group allows SSH
```

### Workflow Fails: Git Pull
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_IP>
cd /home/ubuntu/data-deals

# Test git pull manually
git pull origin main

# If fails, check deploy key is added to GitHub
```

### Application Not Running
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_IP>

# Check PM2 status
pm2 list

# Check logs
pm2 logs data-deals

# Restart if needed
pm2 restart data-deals
```

### Build Fails
```bash
# Check Node.js version
node --version  # Should be 20+

# Check dependencies
cd /home/ubuntu/data-deals
npm install

# Check Prisma
npx prisma generate
```

---

## Verification Checklist

After setup, verify:

- [ ] GitHub Actions workflow runs successfully
- [ ] Application is accessible at `http://<EC2_IP>`
- [ ] PM2 process is running (`pm2 list`)
- [ ] Nginx is running (`sudo systemctl status nginx`)
- [ ] Database is accessible
- [ ] Admin dashboard works (`/admin`)
- [ ] Automatic deployment works on push to `main`

---

## Next Steps (Optional)

- [ ] Set up domain name and DNS
- [ ] Configure SSL with Let's Encrypt
- [ ] Set up monitoring/alerting
- [ ] Configure database backups
- [ ] Set up staging environment

---

## Quick Commands Reference

```bash
# On EC2 - Check status
pm2 list
pm2 logs data-deals
sudo systemctl status nginx

# On EC2 - Manual deployment
cd /home/ubuntu/data-deals
bash scripts/deploy.sh

# On EC2 - Restart app
pm2 restart data-deals

# On Local - SSH into EC2
ssh -i your-key.pem ubuntu@<EC2_IP>
```

