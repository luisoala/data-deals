# Documentation Index

Complete documentation for the Data Deals Interactive Website.

## Getting Started

- **[Setup Checklist](SETUP_CHECKLIST.md)** - Step-by-step setup instructions for local development
- **[GitHub OAuth Setup](GITHUB_OAUTH_SETUP.md)** - How to configure authentication for admin access

## Data & Development

- **[Data Model](DATA_MODEL.md)** - Complete documentation of the data structure, workflow, and best practices
- **Data Directory**: See `../data/README.md` for quick reference on the data files

## Deployment

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions and EC2 setup
- **[Automated Deployment Plan](AUTOMATED_DEPLOYMENT_PLAN.md)** - CI/CD workflow details and GitHub Actions configuration

## Quick Reference

### Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run dev:setup        # Full setup (install, db, sync)
npm run sync             # Sync deals.json → database
npm run export:db        # Export database → deals.json

# Database
npm run db:studio        # Open Prisma Studio
npm run db:push          # Push schema changes

# Production
npm run build            # Build for production
npm run start            # Start production server
```

### Key Files

- `data/deals.json` - Single source of truth for all deals
- `prisma/schema.prisma` - Database schema
- `scripts/deploy.sh` - Production deployment script
- `.github/workflows/deploy.yml` - CI/CD workflow

## Project Structure

```
data-deals/
├── data/              # Deal data (deals.json)
├── app/               # Next.js app (pages, API routes)
├── components/        # React components
├── lib/               # Shared utilities (auth, prisma)
├── prisma/            # Database schema
├── scripts/           # Build & deployment scripts
└── docs/              # This documentation
```

## Need Help?

1. **Local setup issues**: See [Setup Checklist](SETUP_CHECKLIST.md)
2. **Authentication problems**: See [GitHub OAuth Setup](GITHUB_OAUTH_SETUP.md)
3. **Data questions**: See [Data Model](DATA_MODEL.md)
4. **Deployment issues**: See [Deployment Guide](DEPLOYMENT.md)

