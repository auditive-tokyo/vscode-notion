# AI Assistant Guide

Project: Notion-VSCode (VS Code extension)

---

## Quick Commands

| Task              | Command                     |
| ----------------- | --------------------------- |
| Type check        | `npm run typecheck`         |
| Lint              | `npm run lint`              |
| Lint (fix)        | `npm run lint:fix`          |
| Build             | `npm run build`             |
| Watch             | `npm run watch`             |
| Package extension | `npm run package-extension` |
| Publish extension | `npm run publish-extension` |

Primary verification commands are `npm run typecheck` and `npm run lint`.

---

## Project Overview

Notion-VSCode is a VS Code extension that renders Notion content inside VS Code. It includes a React-based webview and a TypeScript extension host.

- Language: TypeScript
- Webview: React + Tailwind
- Build: Webpack

---

## Structure

- src/
  - extension.ts (VS Code extension entry)
  - ui/ (tree views, commands)
  - notion-api-utils/ (Notion data conversion)
  - webview/ (React UI for rendering)
- resources/ (icons, fonts)
- docs/

Architecture details live in docs/ARCHITECTURE.md.

---

## TypeScript Configs

- tsconfig.json: typecheck for src/\*\* (extension host)
- src/webview/tsconfig.json: typecheck for webview
- tsconfig.config.json: typecheck for config files

Config files checked by tsconfig.config.json:

- webpack.config.ts
- tailwind.config.js
- eslint.config.mjs
- postcss.config.js

---

## CI (Quality Check)

Quality Check workflow runs on PRs to main for these paths:

- src/\*\*
- package.json
- package-lock.json
- tsconfig.json
- tsconfig.config.json
- webpack.config.ts
- tailwind.config.js
- eslint.config.mjs
- postcss.config.js

Jobs:

- TypeCheck & Lint
- SonarCloud Analysis (depends on TypeCheck & Lint)

---

## Notes

- Prefer path alias `@/*` for src imports where applicable.
- Keep changes within feature areas; avoid unrelated refactors.
