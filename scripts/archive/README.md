# Archive: Paper Extraction Scripts

This folder contains scripts that were used for one-time data extraction from the paper materials (LaTeX files, bib files).

**These scripts are NOT used in production** and are kept here for historical reference only.

## Scripts

- `sync-latex-to-db.ts` - Extracts deals from LaTeX table files (deprecated)
- `parse-bib-urls.js.deprecated` - Parses bib files to extract URLs (deprecated)
- `migrate-to-unified-model.js` - One-time migration script that merged URLs into deals.json

## Related Archives

- Paper materials (LaTeX files, bib files) are in `data/archive/data_deals-neurips_camera_ready-latex/`
- Legacy data files are in `data/archive/`

## Current Workflow

The current production workflow uses:
- `scripts/extract-deals.js` - Generates deals.json from hardcoded array
- `scripts/sync-json-to-db.ts` - Syncs deals.json → database

Data is now standalone in `data/deals.json` with no dependency on paper materials.

