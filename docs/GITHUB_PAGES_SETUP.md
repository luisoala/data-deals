# GitHub Pages Setup Guide

This guide explains how to serve the application via GitHub Pages (`datadeals.github.io`) while keeping the EC2 server running.

## Current Architecture

- **EC2 Server**: Full Next.js app with API routes, database, authentication
- **Domain**: Currently using EC2 IP or custom domain
- **Features**: Dynamic content, admin panel, API endpoints, database queries

## GitHub Pages Limitations

**Important**: GitHub Pages only serves **static HTML/CSS/JS files**. It cannot:
- Run server-side code (API routes)
- Execute Node.js/Next.js server
- Access databases
- Handle authentication server-side
- Process form submissions server-side

## Options

### Option 1: Static Export + API Proxy (Hybrid) ⚠️ Complex

**How it works:**
- Export Next.js as static site for GitHub Pages
- Point API calls to EC2 server
- Use GitHub Pages domain for frontend, EC2 for backend

**Pros:**
- Free HTTPS via GitHub Pages
- Professional domain (`datadeals.github.io`)
- Fast CDN delivery for static assets

**Cons:**
- **CORS issues**: GitHub Pages (HTTPS) → EC2 (HTTP) = mixed content blocked
- **CORS issues**: GitHub Pages (HTTPS) → EC2 (HTTPS) = CORS headers needed
- API calls must be proxied or CORS-enabled
- Admin panel won't work (needs server-side auth)
- More complex deployment (two deployments)
- API endpoints exposed publicly

**Implementation:**
1. Export Next.js as static: `next export` (or `output: 'export'` in `next.config.js`)
2. Deploy static files to `gh-pages` branch
3. Configure API calls to point to EC2
4. Set up CORS on EC2 API routes
5. Handle authentication differently (client-side only)

### Option 2: Custom Domain Pointing to EC2 ✅ Recommended

**How it works:**
- Point `datadeals.github.io` (or custom domain) DNS to EC2 IP
- Use Let's Encrypt SSL on EC2 (already supported)
- Single deployment, full functionality

**Pros:**
- ✅ Full Next.js functionality (API, auth, database)
- ✅ Single deployment
- ✅ Free SSL via Let's Encrypt
- ✅ Professional domain
- ✅ No CORS issues
- ✅ Admin panel works

**Cons:**
- Requires DNS configuration
- EC2 must handle all traffic (no CDN for static assets)
- EC2 IP must be stable (use Elastic IP)

**Implementation:**
1. Get Elastic IP for EC2 (prevents IP changes)
2. Point DNS A record to EC2 IP
3. Configure `DOMAIN_NAME` secret in GitHub Actions
4. Deploy script will auto-configure SSL

### Option 3: Cloudflare Proxy (Best of Both Worlds) ⭐ Recommended

**How it works:**
- Use Cloudflare DNS (free)
- Point `datadeals.github.io` or custom domain to EC2 via Cloudflare
- Cloudflare provides:
  - Free SSL (automatic HTTPS)
  - CDN caching for static assets
  - DDoS protection
  - DNS management

**Pros:**
- ✅ Full Next.js functionality
- ✅ Free SSL (Cloudflare or Let's Encrypt)
- ✅ CDN for static assets (faster)
- ✅ DDoS protection
- ✅ Single deployment
- ✅ Professional domain

**Cons:**
- Requires Cloudflare account (free)
- Slight complexity in DNS setup

**Implementation:**
1. Create Cloudflare account
2. Add domain (or use subdomain)
3. Point DNS to EC2 IP
4. Enable Cloudflare proxy (orange cloud)
5. SSL: Automatic (Cloudflare) or Full (Let's Encrypt on EC2)

## Recommended Approach: Option 3 (Cloudflare)

### Step-by-Step Setup

#### 1. Get Elastic IP for EC2

```bash
# In AWS Console:
# EC2 → Elastic IPs → Allocate Elastic IP → Associate with EC2 instance
```

This ensures your EC2 IP doesn't change.

#### 2. Set Up Cloudflare

1. **Create Cloudflare account** (free): https://dash.cloudflare.com/sign-up
2. **Add site**: Add your domain or use `datadeals.github.io` subdomain
3. **Update nameservers**: Point domain nameservers to Cloudflare (if using custom domain)
   - OR: If using GitHub Pages subdomain, you'll need to use a custom domain instead

**Note**: GitHub Pages subdomains (`*.github.io`) cannot be proxied through Cloudflare directly. You have two options:
- **Option A**: Use a custom domain (e.g., `datadeals.ai`, `datadeals.org`)
- **Option B**: Use Cloudflare DNS with a subdomain (e.g., `app.datadeals.org`)

#### 3. Configure DNS in Cloudflare

1. Go to **DNS** → **Records**
2. Add **A record**:
   - **Name**: `@` (or `app` for subdomain)
   - **IPv4 address**: Your EC2 Elastic IP
   - **Proxy status**: ✅ Proxied (orange cloud)
   - **TTL**: Auto

#### 4. Configure SSL in Cloudflare

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full** or **Full (strict)**
   - **Full**: Cloudflare ↔ EC2 can use HTTP (Cloudflare handles HTTPS)
   - **Full (strict)**: EC2 must have valid SSL certificate

#### 5. Update GitHub Actions Secrets

Add to GitHub Secrets:
- `DOMAIN_NAME`: Your domain (e.g., `app.datadeals.org` or `datadeals.ai`)
- `CERTBOT_EMAIL`: Your email for Let's Encrypt

#### 6. Update GitHub OAuth App

Update your GitHub OAuth app callback URL:
- From: `http://100.30.119.82/api/auth/callback/github`
- To: `https://your-domain.com/api/auth/callback/github`

#### 7. Deploy

The existing deployment script will:
- Detect `DOMAIN_NAME` secret
- Configure Nginx for HTTPS
- Obtain Let's Encrypt certificate
- Set `NEXTAUTH_URL` to `https://your-domain.com`

## Alternative: Using GitHub Pages Subdomain Directly

If you want to use `datadeals.github.io` specifically:

### Limitations:
- GitHub Pages subdomain cannot be proxied through Cloudflare
- Must use DNS A record pointing directly to EC2
- No CDN benefits
- Still need SSL on EC2

### Setup:
1. **Get Elastic IP** for EC2
2. **Point DNS**: In your domain registrar, add A record:
   - `datadeals.github.io` → EC2 Elastic IP
   - **OR**: Use CNAME if GitHub Pages is already set up, then point custom domain to EC2
3. **Configure GitHub Pages**: 
   - Repository Settings → Pages
   - Custom domain: `datadeals.github.io` (or your custom domain)
   - **Note**: GitHub Pages will try to serve static content, which conflicts with EC2
4. **Disable GitHub Pages static hosting** (since EC2 serves everything)
5. **Configure EC2** with `DOMAIN_NAME` secret

**Problem**: GitHub Pages expects to serve static files, but you're serving from EC2. This creates a conflict.

**Solution**: Use a custom domain instead of `datadeals.github.io`, or use a subdomain like `app.datadeals.org`.

## Side Effects and Considerations

### Using GitHub Pages Static Export (Option 1)

**Breaking Changes:**
- ❌ Admin panel won't work (needs server-side auth)
- ❌ API routes won't work (no server)
- ❌ Database queries won't work
- ❌ Form submissions won't work
- ❌ Real-time features won't work

**Required Changes:**
- Convert API routes to external API calls
- Move authentication to client-side only
- Remove server-side features
- Handle CORS on EC2 API

### Using Custom Domain + EC2 (Options 2 & 3)

**No Breaking Changes:**
- ✅ Everything works as-is
- ✅ Admin panel works
- ✅ API routes work
- ✅ Database works
- ✅ Authentication works

**Considerations:**
- EC2 must be running 24/7
- EC2 handles all traffic (unless using Cloudflare CDN)
- Need stable IP (Elastic IP)
- SSL certificate renewal (automatic with Let's Encrypt)

## Recommended Implementation: Cloudflare + Custom Domain

### Quick Start

1. **Get Elastic IP**:
   ```bash
   # AWS Console: EC2 → Elastic IPs → Allocate → Associate with instance
   ```

2. **Set up Cloudflare**:
   - Sign up: https://dash.cloudflare.com
   - Add domain (or use subdomain like `app.yourdomain.com`)
   - Add A record pointing to EC2 Elastic IP
   - Enable proxy (orange cloud)
   - Set SSL to "Full"

3. **Update GitHub Secrets**:
   - `DOMAIN_NAME`: Your Cloudflare domain (e.g., `app.datadeals.org`)
   - `CERTBOT_EMAIL`: Your email

4. **Update GitHub OAuth App**:
   - Callback URL: `https://your-domain.com/api/auth/callback/github`

5. **Deploy**:
   - Push to `main` branch
   - Deployment will auto-configure SSL

### Verification

After deployment:
- ✅ `https://your-domain.com` loads
- ✅ SSL certificate valid (green lock)
- ✅ Admin panel works
- ✅ API routes work
- ✅ No CORS errors

## Cost Comparison

| Option | Cost | Features |
|--------|------|----------|
| **GitHub Pages Static** | Free | Limited (static only) |
| **EC2 + Custom Domain** | EC2 cost only | Full features |
| **Cloudflare + EC2** | EC2 cost only | Full features + CDN |

## Next Steps

1. **Decide on domain**: Custom domain or subdomain?
2. **Get Elastic IP**: Prevent IP changes
3. **Set up Cloudflare**: Free CDN + SSL
4. **Update secrets**: Add `DOMAIN_NAME` to GitHub Actions
5. **Deploy**: Existing script handles SSL automatically

## Questions?

- **Q**: Can I use `datadeals.github.io` directly?
  - **A**: Not recommended - GitHub Pages expects static files, conflicts with EC2

- **Q**: Do I need to change code?
  - **A**: No, if using custom domain + EC2. Yes, if using static export.

- **Q**: Will admin panel work?
  - **A**: Yes, with custom domain + EC2. No, with static export.

- **Q**: Is Cloudflare free?
  - **A**: Yes, free tier includes CDN, SSL, DNS, DDoS protection.

