# Archive: Legacy Data Files and Paper Materials

This folder contains data files and paper materials that are no longer used in production.

## Files

- `ref-urls.json` - Legacy URL mapping file
  - URLs were merged into `deals.json` as `source_url` fields
  - No longer needed since `deals.json` is the single source of truth

- `data_deals-neurips_camera_ready-latex/` - Original paper materials
  - LaTeX files, bib files, and figures from the NeurIPS 2025 paper
  - Used for one-time data extraction, now archived
  - Scripts that used these files are in `scripts/archive/`

## Current Production Data

- `data/deals.json` - Single source of truth containing all deals with `source_url` included

