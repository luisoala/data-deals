# Audit Log Setup

## Overview

The audit log system tracks all changes to the data deals database, including:
- Suggestion submissions (who submitted, when, IP address)
- Suggestion approvals/rejections (who reviewed, when)
- Deal creation/updates (via suggestions)

## Database Schema

The audit log is stored in the `AuditLog` table in the SQLite database (`prisma/prod.db`), which:
- **Persists across redeploys** (database files are gitignored)
- **Stays on server only** (never synced to git)
- **Survives git pulls** (database is not touched by deployment)

## Setup Instructions

### 1. Update Database Schema

After pulling the latest code, run:

```bash
# On the server
cd /home/ubuntu/data-deals
npx prisma db push
```

This will:
- Add the `AuditLog` table
- Add `submitted_by` field to `Suggestion` table
- Create necessary indexes

### 2. Verify Migration

Check that the tables were created:

```bash
sqlite3 prisma/prod.db ".schema AuditLog"
sqlite3 prisma/prod.db ".schema Suggestion"
```

You should see:
- `AuditLog` table with fields: `id`, `action`, `entity_type`, `entity_id`, `user`, `ip_address`, `details`, `created_at`
- `Suggestion` table with new `submitted_by` field

### 3. Restart Application

```bash
pm2 restart data-deals
```

## Features

### Audit Log Actions Tracked

1. **suggestion_submitted** - When a user submits a suggestion
2. **suggestion_approved** - When an admin approves a suggestion
3. **suggestion_rejected** - When an admin rejects a suggestion
4. **deal_created** - When a new deal is created (via approved suggestion)
5. **deal_updated** - When an existing deal is updated (via approved suggestion)

### Admin UI

Access the audit log via the Admin Dashboard:
1. Go to `/admin`
2. Click the "Audit Log" tab
3. View, filter, and paginate through audit entries

### API Endpoint

Admins can also query audit logs via API:

```
GET /api/audit-logs?limit=100&offset=0&action=suggestion_approved&entity_type=suggestion&user=username
```

Query parameters:
- `limit` - Number of entries to return (default: 100)
- `offset` - Pagination offset (default: 0)
- `action` - Filter by action type
- `entity_type` - Filter by entity type (`suggestion` or `deal`)
- `user` - Filter by GitHub username or IP address

## Data Persistence

### How Audit Logs Persist

1. **Database Location**: `prisma/prod.db` (SQLite file)
2. **Git Ignored**: `*.db` files are in `.gitignore`
3. **Not Synced**: Database never gets pushed to git
4. **Survives Redeploys**: Database file persists on server across:
   - Git pulls
   - Code deployments
   - PM2 restarts
   - Server reboots (if database is on persistent storage)

### Comparison with Deals Data

| Data Type | Storage | Synced to Git | Persists Across Redeploys |
|-----------|--------|---------------|---------------------------|
| **Deals** | `data/deals.json` | ✅ Yes | ✅ Yes (via git merge) |
| **Audit Logs** | `prisma/prod.db` | ❌ No | ✅ Yes (stays on server) |

## Usage Examples

### View Recent Audit Logs

```bash
# On server
sqlite3 prisma/prod.db "SELECT * FROM AuditLog ORDER BY created_at DESC LIMIT 10;"
```

### Find All Actions by a User

```bash
sqlite3 prisma/prod.db "SELECT * FROM AuditLog WHERE user = 'luisoala' ORDER BY created_at DESC;"
```

### Count Actions by Type

```bash
sqlite3 prisma/prod.db "SELECT action, COUNT(*) as count FROM AuditLog GROUP BY action;"
```

## Troubleshooting

### Database Schema Not Updated

If you see errors about missing `AuditLog` table:

```bash
cd /home/ubuntu/data-deals
npx prisma generate
npx prisma db push
pm2 restart data-deals
```

### Audit Logs Not Appearing

1. Check that audit logs are being created:
   ```bash
   sqlite3 prisma/prod.db "SELECT COUNT(*) FROM AuditLog;"
   ```

2. Check application logs for errors:
   ```bash
   pm2 logs data-deals | grep -i audit
   ```

3. Verify API endpoint is accessible:
   ```bash
   curl https://research.brickroad.network/neurips2025-data-deals/api/audit-logs
   ```

## Security Notes

- Audit logs are **admin-only** - only users in `ADMIN_GITHUB_USERNAMES` can view them
- IP addresses are logged for security/audit purposes
- Audit logs are never exposed publicly or synced to git
- Database file should be backed up regularly (not in git)

