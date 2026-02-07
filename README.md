# Notion-VSCode

> 🚀 Browse and explore your Notion pages directly in Visual Studio Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.0.1-blue.svg)](https://github.com/auditive-tokyo/Notion-VSCode)
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)](https://nodejs.org)

## ✨ Features

- 📖 **Browse Notion Pages** - View your Notion workspace as a hierarchical tree in the sidebar
- 📄 **Full Markdown Support** - Rich text formatting, code blocks, callouts, and more
- 📊 **Inline Databases** - View and interact with database records in multiple formats:
  - 📋 Table view
  - 📅 Calendar view (date-based)
  - 📈 Timeline view (date ranges)
  - 📊 Kanban board view (status-based)
- 🎨 **Mermaid Diagrams** - Render Mermaid diagrams directly in the preview
- 🌙 **Light & Dark Mode** - Seamlessly supports VS Code themes
- 🔄 **Real-time Sync** - Automatic synchronization with your Notion workspace
- ♿ **Accessibility First** - WCAG compliant with proper semantic HTML
- 🔒 **Official Notion API** - Uses Notion's official public API (no scraping)

## 🎯 Use Cases

- 📚 **Knowledge Management** - Browse your documentation and notes without leaving VS Code
- 🗂️ **Project Management** - View databases and track project progress
- 📝 **Content Creation** - Reference Notion content while writing code
- 🔍 **Quick Lookup** - Instantly search and view Notion pages via command palette

## 🚀 Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for **"Notion-VSCode"**
4. Click Install

### Manual Installation

```bash
git clone https://github.com/auditive-tokyo/Notion-VSCode.git
cd Notion-VSCode
npm install
npm run build
# Package as .vsix and install manually
```

## 📖 Getting Started

### 1. Create a Notion Integration

1. Go to [notion.com/integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Give your integration a name (e.g., "VSCode Notion")
4. Copy your **Internal Integration Token**

### 2. Share Pages with Your Integration

1. In Notion, open any page you want to view
2. Click **"Share"** → **"Invite"**
3. Search for your integration name and add it

### 3. Connect to VS Code

1. Open VS Code with Notion-VSCode installed
2. Open the command palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Run `Notion: Set API Token`
4. Paste your integration token
5. Your Notion workspace will appear in the sidebar

### 4. Browse Your Pages

- Click any page in the tree to view its content
- Switch between different view modes for databases (Table, Calendar, Timeline, Board)
- Use the **"Open in Notion"** button to edit in Notion directly

## 🏗️ Architecture

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

## 🔧 Available Commands

All configuration is done through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `Notion: Set API Token`  | Set your Notion integration token               |
| `Notion: Open Root Page` | Open the root page of your workspace            |
| `Notion: Clear Cache`    | Clear cached pages (useful if content is stale) |

Run `Notion:` in the command palette to see all available commands.

## 📚 Supported Notion Blocks

- ✅ Heading (H1, H2, H3)
- ✅ Paragraph
- ✅ Bulleted/Numbered lists
- ✅ Toggles
- ✅ Code blocks (with syntax highlighting)
- ✅ Tables
- ✅ Callouts
- ✅ Dividers
- ✅ Quotes
- ✅ Mermaid diagrams
- ✅ Images (embedded links)
- ✅ Inline databases

## 🐛 Known Limitations

- Your integration can only access pages that have been explicitly shared with it in your Notion workspace (both public and private)
- Editing is not yet supported (view-only mode)
- Some advanced Notion features may not render perfectly
- Page updates require manual refresh (toggle panel off/on)

## 💡 Tips & Tricks

### Keyboard Shortcuts

| Command              | Windows/Linux | macOS       |
| -------------------- | ------------- | ----------- |
| Open command palette | Ctrl+Shift+P  | Cmd+Shift+P |
| Focus Notion sidebar | Ctrl+Shift+E  | Cmd+Shift+E |

### Quick Tips

- Use `F5` to launch the extension in development mode
- Run `Notion: Set API Token` to configure your integration
- Run `Notion: Clear Cache` to refresh stale page data
- Run `Notion: Open Root Page` to jump to your workspace root

### Performance

- The extension caches pages to reduce API calls
- Large databases (1000+ items) may load slower
- Use the Board view for better performance with status-based databases

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
git clone https://github.com/auditive-tokyo/Notion-VSCode.git
cd Notion-VSCode
npm install
npm run build
```

### Running in Development

```bash
# Open VS Code with the extension loaded
code --extensionDevelopmentPath=.
```

### Running Tests

```bash
npm test
npm run test:watch
```

### Code Quality

```bash
npm run lint          # ESLint
npm run format        # Prettier
npm run check         # Type checking
```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(webview): add timeline view for date ranges"
git commit -m "fix(api): handle database pagination correctly"
git commit -m "docs: update installation guide"
```

### Pull Request Process

1. Fork this repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m '...'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request
6. Ensure all tests pass and code quality checks are met

## 🐞 Reporting Issues

Found a bug? [Open an issue](https://github.com/auditive-tokyo/Notion-VSCode/issues) with:

- **Clear title** describing the problem
- **Steps to reproduce** the issue
- **Expected vs actual** behavior
- **Screenshots** if applicable
- **VS Code version** and **extension version**

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Attribution

Originally inspired by earlier Notion-VSCode projects, extensively rewritten and modernized with:

- Modern TypeScript (strict mode)
- Official Notion API integration
- Production-ready accessibility and security standards
- Multi-view database support
- Enhanced Markdown rendering

## 🙋 Support

### Getting Help

- 📖 [Read the docs](https://github.com/auditive-tokyo/Notion-VSCode/wiki)
- 💬 [Open a discussion](https://github.com/auditive-tokyo/Notion-VSCode/discussions)
- 🐛 [Report a bug](https://github.com/auditive-tokyo/Notion-VSCode/issues)

### Show Your Support

If you find this extension useful, please:

- ⭐ **Star the repository** on GitHub
- 📣 **Share it** with your friends
- 🐛 **Report issues** to help us improve
- 🤝 **Contribute** improvements and features

## 📊 Project Status

- **Version:** 2.0.1
- **Status:** Active Development
- **Last Updated:** February 2025

## 🗺️ Roadmap

- [ ] Page editing support
- [ ] Synced database blocks
- [ ] Custom database filters
- [ ] Page templates
- [ ] Offline mode
- [ ] Rich text editing

## 👨‍💻 Author

Built with ❤️ by the Notion-VSCode community

---

**Made with care for developers who love Notion 💡**
