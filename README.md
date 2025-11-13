# Data Deals Interactive Website

Interactive web application showcasing AI data deals from the NeurIPS 2025 paper "A Sustainable AI Economy Needs Data Deals That Work for Generators".

## Features

- **Interactive Network Graph**: Visualize relationships between data receivers and aggregators
- **Advanced Filtering**: Filter by year, value, content type, and deal codes
- **Sortable Table**: Explore all 73 data deals with sorting capabilities
- **Community Contributions**: Users can suggest edits or new entries
- **Admin Dashboard**: Review and approve suggestions (GitHub OAuth required)

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **Graph Visualization**: D3.js
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Prisma
- **Authentication**: NextAuth.js with GitHub OAuth

## Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd data-deals
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL`: Database connection string
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `GITHUB_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
- `ADMIN_GITHUB_USERNAMES`: Comma-separated list of admin GitHub usernames

4. Set up the database and start development:
```bash
# Full setup (installs packages, sets up DB, syncs data, starts server)
npm run dev:setup

# OR manually:
npm run setup  # Install packages, generate Prisma, push DB, sync data
npm run dev    # Start dev server
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Quick Restart

For quick restarts during development (after initial setup):
```bash
# Restart dev server with data sync
bash scripts/dev-restart.sh

# OR just restart without sync
npm run dev
```

## Data Structure

The source of truth for deals data is `data/deals.json`. This file is synced to the database on deployment.

### Deal Schema

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
}
```

## Deployment

### EC2 Setup

1. Launch an EC2 instance (Ubuntu)
2. Install Node.js, npm, PM2, and Nginx
3. Clone the repository
4. Set up environment variables
5. Configure Nginx as reverse proxy
6. Set up PM2 to run the Next.js app

### GitHub Actions

The repository includes a GitHub Actions workflow that automatically deploys to EC2 on push to main branch.

Required secrets:
- `EC2_HOST`: EC2 instance IP or domain
- `EC2_USER`: SSH username (usually `ubuntu`)
- `EC2_SSH_KEY`: Private SSH key for EC2 access

## Development

### Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run sync`: Sync JSON data to database
- `npm run db:studio`: Open Prisma Studio

### Adding New Deals

1. Edit `data/deals.json` directly, or
2. Use the "Suggest New Entry" button on the website
3. Admin can approve suggestions via the admin dashboard

## License

Apache License 2.0

