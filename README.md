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

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn

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

Edit `.env` with your configuration (see [docs/setup.md](docs/SETUP_CHECKLIST.md) for details).

4. Set up database and start development:
```bash
npm run dev:setup
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Available Scripts

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

## Deployment

The repository includes automated deployment via GitHub Actions to EC2.

See [docs/deployment.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Setup Guide](docs/SETUP_CHECKLIST.md) - Step-by-step setup instructions
- [Deployment Guide](docs/DEPLOYMENT.md) - Deployment and admin access details
- [GitHub OAuth Setup](docs/GITHUB_OAUTH_SETUP.md) - Authentication configuration
- [Automated Deployment Plan](docs/AUTOMATED_DEPLOYMENT_PLAN.md) - CI/CD setup details

## Security

**Important**: This is a public repository. Never commit:

- API keys or secrets
- Environment variables (`.env` files)
- Private SSH keys
- Database credentials
- OAuth client secrets

All sensitive configuration should be stored in GitHub Secrets (for CI/CD) or environment variables (for local development).

## License

Apache License 2.0
