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
- **CI/CD**: Manual deployment via `deploy.sh` script (no GitHub Actions currently configured)

## CI/CD on EC2

### Current Setup

**No automated CI/CD pipeline exists yet.** Deployment is currently manual via SSH.

### Manual Deployment Process

1. **Deploy Script**: `scripts/deploy.sh`
   - Pulls latest changes from `main` branch
   - Installs dependencies (`npm install`)
   - Generates Prisma client (`npx prisma generate`)
   - Runs database migrations (`npx prisma db push`)
   - Syncs JSON data to database (`npm run sync`)
   - Builds Next.js app (`npm run build`)
   - Restarts PM2 process

2. **To Deploy**:
   ```bash
   # SSH into EC2 instance
   ssh ubuntu@<ec2-ip>
   
   # Run deployment script
   cd /home/ubuntu/data-deals
   bash scripts/deploy.sh
   ```

### EC2 Infrastructure

**Setup Script**: `scripts/setup-ec2.sh`
- Installs Node.js 20
- Installs PM2 (process manager)
- Installs Nginx (reverse proxy)
- Configures Nginx to proxy requests to Next.js on port 3000
- Sets up PM2 to auto-start on boot

**Current Stack**:
- **Nginx**: Listens on port 80, proxies to `localhost:3000`
- **PM2**: Manages Next.js process (`pm2 start npm --name "data-deals" -- start`)
- **App Directory**: `/home/ubuntu/data-deals`

### Missing: GitHub Actions CI/CD

The README mentions GitHub Actions, but **no workflow file exists**. To set up automated CI/CD:

1. Create `.github/workflows/deploy.yml`
2. Configure secrets:
   - `EC2_HOST`: EC2 instance IP/domain
   - `EC2_USER`: SSH username (usually `ubuntu`)
   - `EC2_SSH_KEY`: Private SSH key for EC2 access
3. Workflow should:
   - Trigger on push to `main`
   - SSH into EC2
   - Run `deploy.sh` script

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

Required for production:

```bash
# Database
DATABASE_URL="file:./dev.db"  # SQLite (dev) or PostgreSQL URL (prod)

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"

# GitHub OAuth
GITHUB_CLIENT_ID="<from GitHub OAuth app>"
GITHUB_CLIENT_SECRET="<from GitHub OAuth app>"

# Admin Access
ADMIN_GITHUB_USERNAMES="username1,username2"
```

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

