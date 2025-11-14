# Data Deals Interactive Website

Interactive web application showcasing AI data deals from the NeurIPS 2025 paper "A Sustainable AI Economy Needs Data Deals That Work for Generators".

## What This Is

A Next.js web application that visualizes and manages a dataset of 73 AI data deals, featuring:
- Interactive network graph visualization
- Filterable, sortable data table
- Community-driven suggestions for edits/new entries
- Admin dashboard for content moderation (GitHub OAuth)

## Quick Start

```bash
npm install
npm run dev:setup
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
data-deals/
├── app/                    # Next.js App Router
│   ├── admin/              # Admin dashboard page
│   ├── api/                # API routes (deals, suggestions, auth)
│   ├── auth/               # Authentication pages
│   ├── page.tsx            # Main homepage
│   └── layout.tsx          # Root layout
├── components/             # React components
│   ├── AdminDashboard.tsx
│   ├── DealsTable.tsx
│   ├── Filters.tsx
│   ├── NetworkGraph.tsx
│   └── SuggestionModal.tsx
├── data/                   # Data files
│   ├── deals.json          # Single source of truth (73 deals)
│   ├── README.md           # Data documentation
│   └── archive/            # Historical paper materials
├── docs/                   # Documentation
│   ├── README.md           # Documentation index
│   ├── DATA_MODEL.md       # Data structure details
│   ├── DEPLOYMENT.md       # Deployment guide
│   └── ...
├── lib/                    # Shared utilities
│   ├── auth.ts             # NextAuth configuration
│   └── prisma.ts           # Prisma client
├── prisma/                 # Database
│   └── schema.prisma       # Prisma schema
├── scripts/                # Build & deployment scripts
│   ├── deploy.sh           # Production deployment
│   ├── dev-start.sh        # Local development setup
│   ├── sync-json-to-db.ts  # Sync deals.json → database
│   ├── export-db-to-json.ts # Export database → deals.json
│   └── archive/            # Deprecated scripts
├── public/                 # Static assets
├── middleware.ts           # Next.js middleware (auth)
├── package.json            # Dependencies & scripts
└── tsconfig.json           # TypeScript config
```

## Key Files

- **`data/deals.json`** - Single source of truth for all 73 deals
- **`prisma/schema.prisma`** - Database schema (Deal, Suggestion models)
- **`scripts/deploy.sh`** - Production deployment script (EC2)
- **`.github/workflows/deploy.yml`** - CI/CD workflow

## Available Scripts

```bash
npm run dev              # Start development server
npm run dev:setup        # Full setup (install, db, sync)
npm run build            # Build for production
npm run start            # Start production server
npm run sync             # Sync deals.json → database
npm run export:db        # Export database → deals.json
npm run db:studio        # Open Prisma Studio
npm run db:push          # Push schema changes
```

## Documentation

- **Data**: See `data/README.md` for data structure and workflow
- **All Guides**: See `docs/README.md` for complete documentation index
- **Deployment**: See `docs/DEPLOYMENT.md` for production setup

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: SQLite (dev) / Prisma ORM
- **Auth**: NextAuth.js (GitHub OAuth)
- **Styling**: Tailwind CSS
- **Visualization**: D3.js
- **Deployment**: GitHub Actions → EC2 (PM2, Nginx)

## License

Apache License 2.0
