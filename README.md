# TYFIT App

Static frontend for TYFIT fitness, nutrition, profile, and daily check-in flows.

## Project Structure

- `*.html` - top-level application pages
- `portal/` - diet, food catalog, and admin-facing pages
- `css/` - shared and page-specific styles
- `js/` - shared shell/auth logic and page controllers
- `assets/` - product images, icons, food icons, exercise icons, and JSON data
- `components/` - reusable HTML fragments loaded by `js/components-loader.js`
- `scripts/` - build and data import utilities

## Development

Install dependencies:

```bash
npm install
```

Build optimized static output:

```bash
npm run build
```

The build writes to `dist/`, which is intentionally ignored by git.

## Repository Hygiene

Do not commit generated output, dependency folders, local editor settings, OS metadata, or temporary image sources. The root `.gitignore` covers `node_modules/`, `dist/`, `.tmp/`, `.vscode/`, `.DS_Store`, local env files, and logs.
