# Deployment & Admin Guide

## Overview

This document explains how CI/CD, admin access, and entry updates work in the Data Deals application.

## Architecture

- **Frontend**: Next.js 14+ (App Router) with TypeScript
- **Backend**: Next.js API routes
- **Database**: SQLite (dev) / PostgreSQL (production)
- **ORM**: Prisma
- **Authentication**: NextAuth.js with GitHub OAuth
- **Deployment**: EC2 instance with PM2 + Nginx
- **CI/CD**: Automated deployment via GitHub Actions on push to `main`

## CI/CD on EC2

### Automated Deployment via GitHub Actions

Deployment is fully automated via GitHub Actions. Every push to the `main` branch triggers an automatic deployment to EC2.

**Workflow File**: `.github/workflows/deploy.yml`

**Deployment Process**:
1. Checks out code
2. Installs dependencies and runs linting
3. Uploads files to EC2 via SCP
4. Runs bootstrap script (first-time setup only):
   - Installs Node.js 20, PM2, Nginx
   - Sets up SSL certificate with Let's Encrypt (if domain provided)
   - Configures Nginx for HTTPS (if domain) or HTTP (if IP only)
   - Creates `.env` file with environment variables
5. Runs deployment script (`scripts/deploy.sh`):
   - Pulls latest changes
   - Installs dependencies
   - Generates Prisma client
   - Runs database migrations
   - Syncs JSON data to database
   - Builds Next.js app
   - Restarts PM2 process

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

**Required**:
- `EC2_HOST`: EC2 instance IP address or hostname (e.g., `54.123.45.67`)
- `EC2_USER`: SSH username (usually `ubuntu`)
- `EC2_SSH_KEY`: Private SSH key for EC2 access (full key including headers)
- `OAUTH_CLIENT_ID`: GitHub OAuth app client ID
- `OAUTH_CLIENT_SECRET`: GitHub OAuth app client secret
- `ADMIN_GITHUB_USERNAMES`: Comma-separated GitHub usernames (e.g., `user1,user2`)
- `NEXTAUTH_SECRET`: Secret for NextAuth.js (generate with `openssl rand -base64 32`)

**Optional**:
- `DOMAIN_NAME`: Domain name for SSL certificate (e.g., `example.com`)
- `CERTBOT_EMAIL`: Email for Let's Encrypt certificate (defaults to `admin@DOMAIN_NAME`)
- `EC2_SSH_PORT`: SSH port (defaults to 22)

### SSL/HTTPS Setup

If `DOMAIN_NAME` secret is provided:
- Automatically installs certbot
- Obtains SSL certificate from Let's Encrypt
- Configures Nginx for HTTPS with HTTP→HTTPS redirect
- Sets up automatic certificate renewal
- `NEXTAUTH_URL` is set to `https://DOMAIN_NAME`

If `DOMAIN_NAME` is not provided:
- Uses HTTP only
- `NEXTAUTH_URL` is set to `http://EC2_HOST`

**Important**: For SSL to work:
1. DNS must point `DOMAIN_NAME` to your EC2 instance IP
2. EC2 security group must allow inbound traffic on ports 80 and 443
3. Wait a few minutes after DNS changes before first deployment

### EC2 Infrastructure

**Current Stack**:
- **Nginx**: Reverse proxy (HTTP on port 80, HTTPS on port 443 if domain provided)
- **PM2**: Process manager for Next.js (`pm2 start npm --name "data-deals" -- start`)
- **App Directory**: `/home/ubuntu/data-deals`
- **SSL**: Let's Encrypt certificates (if domain provided)

### Manual Deployment (Fallback)

If GitHub Actions fails, you can deploy manually:

```bash
# SSH into EC2 instance
ssh ubuntu@<ec2-ip>

# Run deployment script
cd /home/ubuntu/data-deals
bash scripts/deploy.sh
```

## Admin Access

### Authentication Flow

1. **GitHub OAuth**: Users sign in via GitHub using NextAuth.js
2. **Admin Check**: Admin status determined by GitHub username in `ADMIN_GITHUB_USERNAMES` env var
3. **Session**: Admin status stored in JWT token and session

### Configuration

**Environment Variables** (`lib/auth.ts`):
- `GITHUB_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app secret
- `ADMIN_GITHUB_USERNAMES`: Comma-separated list (e.g., `"user1,user2,user3"`)

**Admin Check Logic** (`lib/auth.ts:22-23`):
```typescript
const adminUsernames = (process.env.ADMIN_GITHUB_USERNAMES || '').split(',').map(u => u.trim())
token.isAdmin = adminUsernames.includes(profile.login)
```

### Admin Routes

1. **Admin Dashboard**: `/admin` (`app/admin/page.tsx`)
   - Requires authentication
   - Checks `session.user.isAdmin`
   - Shows pending suggestions
   - Allows approve/reject actions

2. **API Routes**:
   - `GET /api/suggestions?status=pending` - List pending suggestions (admin only)
   - `POST /api/suggestions/[id]` - Approve/reject suggestion (admin only)

### Access Control

**Frontend** (`app/admin/page.tsx:30-38`):
- Redirects to GitHub sign-in if not authenticated
- Shows "Unauthorized" if authenticated but not admin

**Backend** (`app/api/suggestions/[id]/route.ts:11-14`):
- Checks `session?.user?.isAdmin` on all admin endpoints
- Returns 401 Unauthorized if not admin

## Updating Entries

### Two Methods

#### Method 1: Direct JSON Edit (Source of Truth)

**File**: `data/deals.json`

1. Edit `data/deals.json` directly
2. Run sync script: `npm run sync` (or `tsx scripts/sync-json-to-db.ts`)
3. Sync script:
   - Reads `data/deals.json`
   - Upserts each deal into database
   - Parses value strings to extract min/max/unit
   - Handles JSON encoding for `codes` array

**Deal Schema**:
```typescript
{
  id: number
  data_receiver: string
  data_aggregator: string
  ref: string
  date: number
  type: string
  value_raw: string
  value_min: number | null
  value_max: number | null
  value_unit: string | null
  codes: string[]
  source_url: string | null
}
```

#### Method 2: Community Suggestions (Web UI)

**Flow**:
1. User clicks "Edit" or "+ Add Entry" on main page
2. `SuggestionModal` component opens (`components/SuggestionModal.tsx`)
3. User fills form and submits
4. Creates suggestion via `POST /api/suggestions`
5. Suggestion stored in database with `status: 'pending'`
6. Admin reviews in `/admin` dashboard
7. Admin approves/rejects via `POST /api/suggestions/[id]`

**Suggestion Model** (`prisma/schema.prisma:37-51`):
- `id`: Auto-increment
- `deal_id`: Nullable (null for new entries)
- `type`: "edit" or "new"
- `fields`: JSON string of deal data
- `status`: "pending", "approved", "rejected"
- `submitted_at`: Timestamp
- `reviewed_at`: Nullable timestamp
- `reviewed_by`: GitHub username

**Approval Process** (`app/api/suggestions/[id]/route.ts:32-90`):
- **New Entry**: Creates new `Deal` record
- **Edit Entry**: Updates existing `Deal` record
- Updates suggestion status to "approved"
- Records reviewer GitHub username and timestamp

### Database Sync

**Sync Script**: `scripts/sync-json-to-db.ts`
- Reads `data/deals.json`
- For each deal:
  - Parses value strings (handles ranges, units, etc.)
  - Upserts into database (creates if new, updates if exists)
  - Stores `codes` as JSON string

**When Sync Runs**:
- During deployment (`deploy.sh`)
- Manually: `npm run sync`
- During dev setup: `npm run dev:setup`

## Data Flow

```
data/deals.json (source of truth)
    ↓
sync-json-to-db.ts
    ↓
Prisma → SQLite/PostgreSQL
    ↓
API Routes (/api/deals, /api/stats)
    ↓
Frontend Components
```

**Community Suggestions Flow**:
```
User submits suggestion
    ↓
POST /api/suggestions
    ↓
Suggestion table (status: pending)
    ↓
Admin reviews in /admin
    ↓
POST /api/suggestions/[id] (approve)
    ↓
Deal table updated/created
```

## Environment Variables

The `.env` file is automatically created during deployment. Environment variables are set from GitHub Secrets:

```bash
# Database
DATABASE_URL="file:./prisma/prod.db"  # SQLite in production

# NextAuth
NEXTAUTH_URL="https://your-domain.com"  # Automatically set from DOMAIN_NAME or EC2_HOST
NEXTAUTH_SECRET="<from NEXTAUTH_SECRET GitHub secret>"

# GitHub OAuth
GITHUB_CLIENT_ID="<from OAUTH_CLIENT_ID GitHub secret>"
GITHUB_CLIENT_SECRET="<from OAUTH_CLIENT_SECRET GitHub secret>"

# Admin Access
ADMIN_GITHUB_USERNAMES="<from ADMIN_GITHUB_USERNAMES GitHub secret>"
```

**Note**: `NEXTAUTH_URL` is automatically configured:
- If `DOMAIN_NAME` secret is set: `https://DOMAIN_NAME`
- Otherwise: `http://EC2_HOST`

## Troubleshooting

### Admin Access Not Working
1. Check `ADMIN_GITHUB_USERNAMES` includes your GitHub username
2. Sign out and sign back in (session needs refresh)
3. Check browser console for errors
4. Verify GitHub OAuth app is configured correctly

### Deployments Failing
1. Check PM2 status: `pm2 list`
2. Check PM2 logs: `pm2 logs data-deals`
3. Verify database connection
4. Check Nginx status: `sudo systemctl status nginx`
5. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

### Suggestions Not Appearing
1. Check suggestion status in database
2. Verify admin is authenticated
3. Check API endpoint returns data: `curl /api/suggestions?status=pending`
4. Check browser network tab for API errors

## Future Improvements

1. **Add GitHub Actions CI/CD**: Automate deployments on push to main
2. **Add database migrations**: Use Prisma migrations instead of `db push`
3. **Add email notifications**: Notify admins of new suggestions
4. **Add suggestion comments**: Allow admins to add notes when rejecting
5. **Add audit log**: Track all changes to deals
6. **Add rollback capability**: Allow reverting approved changes

