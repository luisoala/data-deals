# Data Model Documentation

> **Quick Reference**: See `../data/README.md` for a lightweight overview of the data directory.

## Single Source of Truth: `data/deals.json`

All deal data, including source URLs, is stored in a single JSON file: `data/deals.json`. This is the **ground truth** for all deals.

**Important**: This data is completely standalone and independent from bib files, LaTeX files, or any paper-related sources. Bib files were only used for one-time data extraction and are no longer part of the workflow.

### Data Structure

Each deal in `deals.json` follows this structure:

```json
{
  "id": 1,
  "data_receiver": "DeepMind",
  "data_aggregator": "Moorfields Hospital",
  "ref": "moorfieldsdeepmind2016",
  "date": 2016,
  "type": "Academic",
  "value_raw": "Undisclosed",
  "value_min": null,
  "value_max": null,
  "value_unit": null,
  "codes": ["C"],
  "source_url": "https://www.moorfields.nhs.uk/research/google-deepmind"
}
```

### Required Fields

- `id`: Unique integer identifier
- `data_receiver`: Name of the data receiver (e.g., "OpenAI", "Google")
- `data_aggregator`: Name of the data aggregator (e.g., "Shutterstock", "Reddit")
- `ref`: Reference key used to match with bib files (e.g., "moorfieldsdeepmind2016")
- `date`: Year of the deal (integer)
- `type`: Deal type (e.g., "Academic", "News", "Images", "UGC")
- `value_raw`: Raw value string (e.g., "25-50m", "Undisclosed")
- `value_min`: Parsed minimum value in base units (null if not applicable)
- `value_max`: Parsed maximum value in base units (null if not applicable)
- `value_unit`: Unit description (e.g., "millions", "thousands", "annual")
- `codes`: Array of deal codes (e.g., ["C"], ["C", "S"])
- `source_url`: **Source URL for the deal** (string or null)

## Workflow

### Adding a New Deal

1. **Edit `scripts/extract-deals.js`**:
   - Add the deal to the `rawDeals` array (lines 99-173)
   - Include all required fields
   - **Include `source_url` directly in the deal object**:
     ```javascript
     { 
       receiver: 'OpenAI', 
       aggregator: 'Example', 
       ref: 'example2024', 
       date: 2024, 
       type: 'News', 
       value: '10m', 
       codes: ['C'],
       source_url: 'https://example.com/source'  // ← Include URL here
     }
     ```
   - If URL is not available yet, omit `source_url` (it will default to `null`)

2. **Run the extraction script**:
   ```bash
   node scripts/extract-deals.js
   ```
   This generates `data/deals.json` with the new deal (including `source_url` if provided)

3. **Sync to database**:
   ```bash
   npm run sync
   ```
   This syncs `deals.json` → Database

**Alternative**: If you prefer to add URLs later, you can edit `data/deals.json` directly and add the `source_url` field manually.

### Updating URLs

Simply edit `data/deals.json` directly and update the `source_url` field for any deal. Then run `npm run sync` to update the database.

**Note**: Bib files are no longer used. All URLs are managed directly in `deals.json`.

### Syncing to Database

The sync script (`scripts/sync-json-to-db.ts`) reads from `deals.json` and updates the database:

```bash
npm run sync
```

**Important**: The database is **not** the source of truth. It's synced from `deals.json` during deployment.

## Migration History

The unified data model was created via a one-time migration (`scripts/migrate-to-unified-model.js`) that:
- Merged `ref-urls.json` (which was extracted from bib files) into `deals.json`
- Added `source_url` field to all 73 deals
- Established `deals.json` as the single source of truth
- **Decoupled data from bib files** - data is now completely standalone

## Scripts Reference

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `extract-deals.js` | Generate `deals.json` from hardcoded array | When adding new deals |
| `sync-json-to-db.ts` | Sync `deals.json` → Database | During deployment or manually |
| `migrate-to-unified-model.js` | One-time migration (already completed) | Never (historical) |
| `parse-bib-urls.js.deprecated` | ~~Old script for bib files~~ | **Deprecated** - no longer used |

## Best Practices

1. **Always edit `deals.json` or the scripts that generate it** - never edit the database directly
2. **Add `source_url` manually in `deals.json`** - edit the file directly after running `extract-deals.js`
3. **Run `npm run sync` after updating `deals.json`** to update the database
4. **Commit `deals.json` to git** - it's the source of truth
5. **Data is standalone** - no dependency on bib files, LaTeX, or paper sources

## Deployment

During deployment (`scripts/deploy.sh`), the following happens automatically:

1. Code is pulled from git (including `deals.json`)
2. `npm run sync` is executed
3. Database is updated from `deals.json`
4. Application restarts

No manual steps required - the unified model ensures consistency.

