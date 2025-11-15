# DNS Setup Instructions for research.brickroad.network/neurips2025-data-deals

## Quick Setup Checklist

### 1. DNS Configuration

In your DNS provider (wherever `brickroad.network` is managed):

**Add A Record:**
- **Type**: A
- **Name**: `research` (or `research.brickroad.network` depending on provider)
- **Value**: Your EC2 Elastic IP address
- **TTL**: 3600 (or default)

**Verify DNS:**
```bash
dig research.brickroad.network
# Should return your EC2 IP
```

### 2. Get Elastic IP (if not already done)

**In AWS Console:**
1. EC2 → Elastic IPs → Allocate Elastic IP
2. Associate with your EC2 instance
3. Use this IP in DNS A record

**Why Elastic IP?**
- Prevents IP changes when instance restarts
- Required for stable DNS

### 3. Update GitHub Secrets

Add/Update in GitHub Repository Settings → Secrets and variables → Actions:

- **`DOMAIN_NAME`**: `research.brickroad.network`
- **`CERTBOT_EMAIL`**: Your email (for Let's Encrypt SSL)
- **`EC2_HOST`**: Your EC2 Elastic IP (if not already set)

### 4. Update GitHub OAuth App

**In GitHub → Settings → Developer settings → OAuth Apps:**

Update **Authorization callback URL**:
- **From**: `http://100.30.119.82/api/auth/callback/github`
- **To**: `https://research.brickroad.network/neurips2025-data-deals/api/auth/callback/github`

### 5. Deploy

Push to `main` branch or manually trigger deployment. The deployment will:

1. ✅ Configure Next.js with `basePath: '/neurips2025-data-deals'`
2. ✅ Update Nginx to handle path prefix
3. ✅ Set `NEXTAUTH_URL` to `https://research.brickroad.network/neurips2025-data-deals`
4. ✅ Obtain SSL certificate (if domain is set)
5. ✅ Configure HTTPS redirect

### 6. Verify

After deployment:

1. **Test DNS**: `curl -I http://research.brickroad.network/neurips2025-data-deals`
2. **Test HTTPS**: `https://research.brickroad.network/neurips2025-data-deals`
3. **Test Admin**: Click "Admin Dashboard" → Should redirect to GitHub OAuth
4. **Check SSL**: Browser should show green lock

## What Was Configured

### Code Changes

1. **`next.config.js`**: Added `basePath: '/neurips2025-data-deals'`
2. **`scripts/deploy.sh`**: 
   - Updates Nginx with path rewrite
   - Appends base path to `NEXTAUTH_URL`
   - Configures SSL if domain is set
3. **`scripts/bootstrap.sh`**: Initial Nginx config with path prefix
4. **`.github/workflows/deploy.yml`**: Passes `BASE_PATH` to deploy script

### How It Works

1. **DNS**: `research.brickroad.network` → EC2 IP
2. **Nginx**: Receives request at `/neurips2025-data-deals/*`
3. **Rewrite**: Strips `/neurips2025-data-deals` prefix
4. **Proxy**: Forwards to Next.js at `localhost:3000/*`
5. **Next.js**: Serves app with `basePath` configured
6. **SSL**: Let's Encrypt certificate auto-configured

## Troubleshooting

### DNS Not Resolving

```bash
# Check DNS propagation
dig research.brickroad.network
nslookup research.brickroad.network

# Wait 5-15 minutes after DNS change
```

### SSL Certificate Not Obtaining

1. **Check DNS**: Must resolve before SSL
2. **Check Ports**: EC2 security group must allow 80 and 443
3. **Check Logs**: `sudo certbot certificates`
4. **Manual SSL**: `sudo certbot --nginx -d research.brickroad.network`

### 404 Errors

1. **Check Nginx**: `sudo nginx -t`
2. **Check PM2**: `pm2 logs data-deals`
3. **Check basePath**: Verify `next.config.js` has correct path
4. **Restart**: `pm2 restart data-deals && sudo systemctl reload nginx`

### OAuth Not Working

1. **Check Callback URL**: Must match exactly in GitHub OAuth app
2. **Check NEXTAUTH_URL**: Should include base path
3. **Check Logs**: `pm2 logs data-deals | grep -i auth`

## Expected URLs

After setup:
- **App**: `https://research.brickroad.network/neurips2025-data-deals`
- **API**: `https://research.brickroad.network/neurips2025-data-deals/api/*`
- **Auth**: `https://research.brickroad.network/neurips2025-data-deals/api/auth/*`
- **Admin**: `https://research.brickroad.network/neurips2025-data-deals/admin`

## Next Steps

1. ✅ Set DNS A record
2. ✅ Update GitHub Secrets
3. ✅ Update GitHub OAuth App
4. ✅ Deploy (push to main)
5. ✅ Test and verify

