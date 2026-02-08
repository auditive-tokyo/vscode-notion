# Architecture

```
Notion-VSCode
├── src/
│   ├── ui/                    # VS Code UI components
│   │   ├── notion-tree-provider.ts    # TreeView data provider
│   │   ├── notion-page-viewer.ts      # Page viewer panel
│   │   └── notion-hierarchy-tree-view.ts
│   ├── webview/               # Webview (HTML preview)
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   └── styles.css         # Styling
│   ├── notion-api-utils/      # Notion API utilities
│   │   ├── block-to-markdown.ts
│   │   ├── property-extractor.ts
│   │   └── page-discovery.ts
│   └── extension.ts           # Extension entry point
├── package.json
└── README.md
```
