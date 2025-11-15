# Subdomain + Path Setup Guide

This guide explains how to serve the application at `research.brickroad.network/neurips-data-deals`.

## Overview

To serve the app at a subdomain with a path prefix, you need:
1. **DNS**: Point `research.brickroad.network` to EC2 IP
2. **Next.js**: Configure base path as `/neurips-data-deals`
3. **Nginx**: Proxy requests from `/neurips-data-deals` to Next.js
4. **NextAuth**: Update URLs to include base path
5. **GitHub OAuth**: Update callback URL

## Step-by-Step Setup

### 1. DNS Configuration

In your DNS provider (wherever `brickroad.network` is managed):

**Add A Record:**
- **Type**: A
- **Name**: `research` (or `research.brickroad.network` depending on provider)
- **Value**: Your EC2 Elastic IP (get one if you don't have it)
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

### 3. Configure Next.js Base Path

Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/neurips-data-deals',
  // Optional: if using assetPrefix for CDN
  // assetPrefix: '/neurips-data-deals',
}

module.exports = nextConfig
```

**Important**: After adding `basePath`, Next.js will:
- Prefix all routes with `/neurips-data-deals`
- Update asset paths automatically
- Update `Link` components automatically
- Update API routes automatically

### 4. Update Nginx Configuration

The Nginx config needs to handle the path prefix. Update the bootstrap/deploy script to configure Nginx properly.

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name research.brickroad.network;

    # Handle the path prefix
    location /neurips-data-deals {
        # Remove the prefix before proxying to Next.js
        rewrite ^/neurips-data-deals/?(.*) /$1 break;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Optional: Redirect root to the app
    location = / {
        return 301 /neurips-data-deals;
    }
}
```

**For HTTPS (after SSL setup):**
```nginx
server {
    listen 443 ssl http2;
    server_name research.brickroad.network;

    ssl_certificate /etc/letsencrypt/live/research.brickroad.network/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/research.brickroad.network/privkey.pem;

    location /neurips-data-deals {
        rewrite ^/neurips-data-deals/?(.*) /$1 break;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location = / {
        return 301 /neurips-data-deals;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name research.brickroad.network;
    return 301 https://$server_name$request_uri;
}
```

### 5. Update Environment Variables

**In GitHub Actions Secrets:**
- `DOMAIN_NAME`: `research.brickroad.network`
- `BASE_PATH`: `/neurips-data-deals` (new secret, optional)

**In `.env` file (will be auto-generated):**
- `NEXTAUTH_URL`: `https://research.brickroad.network/neurips-data-deals`
- Note: The deploy script needs to append the base path to NEXTAUTH_URL

### 6. Update GitHub OAuth App

**In GitHub OAuth App Settings:**
- **Authorization callback URL**: 
  - From: `http://100.30.119.82/api/auth/callback/github`
  - To: `https://research.brickroad.network/neurips-data-deals/api/auth/callback/github`

### 7. Update Deploy Script

The deploy script needs to:
1. Read `BASE_PATH` from environment (or hardcode `/neurips-data-deals`)
2. Append base path to `NEXTAUTH_URL`
3. Configure Nginx with the path rewrite

## Implementation Changes Needed

### A. Update `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: process.env.BASE_PATH || '/neurips-data-deals',
}

module.exports = nextConfig
```

### B. Update Deploy Script

Modify `scripts/deploy.sh` to:
1. Read `BASE_PATH` environment variable
2. Append to `NEXTAUTH_URL` when setting it
3. Update Nginx configuration with path rewrite

### C. Update Bootstrap Script

Modify `scripts/bootstrap.sh` to configure Nginx with the path prefix.

## Testing

After deployment:

1. **Test DNS**:
   ```bash
   curl -I http://research.brickroad.network/neurips-data-deals
   ```

2. **Test App**:
   - Visit: `https://research.brickroad.network/neurips-data-deals`
   - Should load the app
   - All links should work
   - API calls should work

3. **Test Authentication**:
   - Click "Admin Dashboard"
   - Should redirect to GitHub OAuth
   - Callback should work

## Troubleshooting

### Issue: 404 on all routes

**Cause**: Nginx rewrite not working or Next.js basePath not set

**Fix**: 
- Check Nginx config has `rewrite ^/neurips-data-deals/?(.*) /$1 break;`
- Verify `next.config.js` has `basePath: '/neurips-data-deals'`
- Restart Nginx: `sudo systemctl restart nginx`
- Restart PM2: `pm2 restart data-deals`

### Issue: Assets (CSS/JS) not loading

**Cause**: Next.js basePath not configured

**Fix**: Ensure `basePath` is set in `next.config.js` and rebuild

### Issue: API routes return 404

**Cause**: API routes also need base path

**Fix**: Next.js handles this automatically with `basePath`, but verify API calls use relative paths (not absolute)

### Issue: OAuth callback fails

**Cause**: Callback URL mismatch

**Fix**: 
- Update GitHub OAuth app callback URL
- Verify `NEXTAUTH_URL` includes base path
- Check browser console for exact callback URL being used

## Alternative: Serve at Root of Subdomain

If you prefer `research.brickroad.network` (without path prefix):

**Simpler setup:**
1. DNS: Point `research.brickroad.network` to EC2
2. Next.js: No `basePath` needed
3. Nginx: Proxy `/` directly to Next.js
4. OAuth: Callback URL is `https://research.brickroad.network/api/auth/callback/github`

**This is simpler** - no path rewriting needed!

## Recommendation

**Option 1**: Use path prefix `/neurips-data-deals` (more complex, requires changes)
**Option 2**: Use subdomain root `research.brickroad.network` (simpler, no code changes)

I recommend **Option 2** unless you need multiple apps on the same subdomain.

