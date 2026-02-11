# Architecture

## Overview

Notion-VSCode is a VS Code extension that renders Notion pages and databases inside VS Code. It uses the extension host for VS Code integration and a React-based webview for rich rendering.

## Key Flows

- Extension activation starts in `src/extension.ts` and registers commands, views, and webview panels.
- Notion API access is handled by `src/notion-api-client.ts` with helper logic in `src/notion-api-utils/`.
- Page discovery and tree navigation live under `src/ui/`, which feeds the Activity Bar TreeView.
- Webview rendering is in `src/webview/` and focuses on Markdown conversion, tables, and inline databases.
- Shared helpers for caching and page ID parsing live in `src/lib/`.

## Repository Structure

```
Notion-VSCode
├── AGENTS.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── eslint.config.mjs
├── package-lock.json
├── package.json
├── postcss.config.js
├── resources
│   ├── fonts
│   │   └── custom-icons.woff
│   └── notion-vscode.png
├── sonar-project.properties
├── src
│   ├── constants.ts
│   ├── extension.ts
│   ├── lib
│   │   ├── cache-utils.ts
│   │   └── page-id-utils.ts
│   ├── notion-api-client.ts
│   ├── notion-api-utils
│   │   ├── block-to-markdown.ts
│   │   ├── index.ts
│   │   ├── markdown-converter.ts
│   │   ├── page-discovery.ts
│   │   ├── property-extractor.ts
│   │   └── types.ts
│   ├── ui
│   │   ├── notion-hierarchy-tree-view.ts
│   │   ├── notion-page-viewer.ts
│   │   ├── notion-tree-provider.ts
│   │   └── open-page-command.ts
│   └── webview
│       ├── components
│       │   ├── MermaidDiagram.tsx
│       │   └── index.ts
│       ├── hooks
│       │   ├── cellUtils.ts
│       │   ├── index.ts
│       │   ├── rehypeTableHeaders.ts
│       │   ├── useCalendarRenderer.tsx
│       │   ├── useBoardRenderer.tsx
│       │   ├── useMarkdownWithInlineDatabases.tsx
│       │   ├── usePageCover.tsx
│       │   ├── useTableRenderer.tsx
│       │   └── useTimelineRenderer.tsx
│       ├── index.tsx
│       ├── styles.css
│       └── tsconfig.json
├── tailwind.config.js
├── tsconfig.config.json
├── tsconfig.json
└── webpack.config.ts
```
