# Notion-VSCode

> 🚀 Browse and explore your Notion pages directly in Visual Studio Code using official Notion integration.
>
> - Official Notion API: only pages shared with your integration API key are visible.
> - Rate limits (free plan: 3 requests/sec) can slow complex pages, but loaded pages are cached for fast display.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Issues](https://img.shields.io/github/issues/auditive-tokyo/Notion-VSCode)](https://github.com/auditive-tokyo/Notion-VSCode/issues)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

|                  Front Page                  |                   Block Rendering                   |
| :------------------------------------------: | :-------------------------------------------------: |
|   ![Front Page](docs/images/frontpage.png)   | ![Block Rendering](docs/images/block-rendering.png) |
|             **Mermaid Diagrams**             |               **Database Rendering**                |
| ![Mermaid Diagrams](docs/images/mermaid.png) | ![Database Rendering](docs/images/db-rendering.png) |

## ✨ Features

- 📖 **Browse Notion Pages** - View your Notion workspace as a hierarchical tree in the sidebar
- 📄 **Full Markdown Support** - Rich text formatting, code blocks, callouts, and more
- 📊 **Inline Databases** - Table, Calendar, Timeline, and Board views
- 🎨 **Mermaid Diagrams** - Render diagrams directly in the preview
- 🌙 **Light & Dark Mode** - Seamlessly supports VS Code themes
- 🔒 **Official Notion API** - Uses Notion's official public API (no scraping)

## 🚀 Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for **"Notion-VSCode"**
4. Click Install

## Why Official Notion API?

This extension uses **Notion's official public API** instead of web scraping. This approach provides:

- ✅ **Stability** - No fragility from HTML structure changes
- ✅ **Security** - Your Notion data stays in your control
- ✅ **Compliance** - Works as intended with Notion's terms of service
- ✅ **Future-proof** - Automatically benefits from Notion API improvements
- ✅ **Transparent** - Explicit permission model through integrations

You control exactly what data the extension can access through integrations.

## ✅ Quick Start

1. Create a Notion integration: [notion.com/integrations](https://www.notion.so/my-integrations)
2. Share the pages you want to view with your integration
3. Open VS Code Settings (Cmd+,)
4. Search for `notion` and paste your API token
5. Your Notion workspace appears in the sidebar

## 📚 Docs

- [Getting Started](docs/GETTING_STARTED.md)
- [Features](docs/FEATURES.md)
- [Commands](docs/COMMANDS.md)
- [Limitations](docs/LIMITATIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development](docs/DEVELOPMENT.md)

## 🐞 Reporting Issues

Found a bug? [Open an issue](https://github.com/auditive-tokyo/Notion-VSCode/issues) with:

- **Clear title** describing the problem
- **Steps to reproduce** the issue
- **Expected vs actual** behavior
- **Screenshots** if applicable
- **VS Code version** and **extension version**

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
