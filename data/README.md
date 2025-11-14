# Data Directory

This directory contains the deal data and related files.

## `deals.json`

The **single source of truth** for all deal data. This JSON file contains all 73 data deals with complete information including source URLs.

### Structure

Each deal has the following fields:
- `id` - Unique identifier
- `data_receiver` - Organization receiving data (e.g., "OpenAI", "Google")
- `data_aggregator` - Organization providing data (e.g., "Shutterstock", "Reddit")
- `ref` - Reference key (e.g., "moorfieldsdeepmind2016")
- `date` - Year of the deal
- `type` - Deal type ("Academic", "News", "Images", "UGC")
- `value_raw` - Raw value string (e.g., "25-50m", "Undisclosed")
- `value_min`, `value_max`, `value_unit` - Parsed value components
- `codes` - Array of deal codes (e.g., ["C"], ["C", "S"])
- `source_url` - Source URL for the deal

### Workflow

1. **Edit `deals.json`** directly to add/update deals
2. **Run `npm run sync`** to sync changes to the database
3. Changes appear on the website after sync

### Adding New Deals

Edit `deals.json` and add a new entry following the existing structure. Ensure:
- `id` is unique (use max existing ID + 1)
- `ref` is unique
- `source_url` is included if available
- Run `npm run sync` after editing

### Frontend Submissions

When users submit suggestions via the website:
- Suggestions are stored in the database
- Admins approve/reject via `/admin` dashboard
- Approved suggestions automatically update `deals.json`
- Production changes are auto-committed to the repo on deploy

## `archive/`

Contains historical data and original paper materials (LaTeX, bib files) used for initial data extraction. These are **not** part of the active workflow.

## See Also

- Detailed data model documentation: `docs/DATA_MODEL.md`
- Development guide: `docs/README.md`

