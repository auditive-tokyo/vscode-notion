[English](../../README.md) | [日本語](README.ja.md)

**Needs to be tranlated（以下翻訳が必要）**

# Notion-VSCode

> 🚀 Browse and explore your Notion pages directly in Visual Studio Code using official Notion integration.
>
> - Official Notion API: only pages shared with your integration API key are visible.
> - API call rate limits (average of 3 requests per second) can slow complex pages, but loaded pages are cached for fast display.

### 🙏 Credits

Big thanks to [kyswtn](https://github.com/kyswtn) for the original [vscode-notion](https://github.com/kyswtn/vscode-notion)! This project is forked from their work and recreated to use the **official Notion API**.

⚠️ **Important**: Due to conflicting extension IDs and commands, this extension cannot be used simultaneously with the original vscode-notion. Please disable or uninstall the original extension before installing this one.

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Issues](https://img.shields.io/github/issues/auditive-tokyo/Notion-VSCode)](https://github.com/auditive-tokyo/Notion-VSCode/issues)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

|                     Front Page                     |                      Block Rendering                      |
| :------------------------------------------------: | :-------------------------------------------------------: |
|   ![Front Page](../../docs/images/frontpage.png)   | ![Block Rendering](../../docs/images/block-rendering.png) |
|                **Mermaid Diagrams**                |                  **Database Rendering**                   |
| ![Mermaid Diagrams](../../docs/images/mermaid.png) | ![Database Rendering](../../docs/images/db-rendering.png) |

## ✨ Features

- 📖 **Browse Notion Pages** - View your Notion workspace as a hierarchical tree in the sidebar
- 📄 **Full Markdown Support** - Rich text formatting, code blocks, callouts, and more
- 📊 **Inline Databases** - Table, Calendar, Timeline, and Board views
- 🎨 **Mermaid Diagrams** - Render diagrams directly in the preview
- 🌙 **Light & Dark Mode** - Seamlessly supports VS Code themes
- 🔒 **Official Notion API** - Uses Notion's official public API (no scraping)

> **Why Official Notion API?**
>
> This extension uses **Notion's official API** instead of web scraping. This approach provides:
>
> - ✅ **Stability** - No fragility from HTML structure changes
> - ✅ **Security** - Your Notion data stays in your control
> - ✅ **Compliance** - Works as intended with Notion's terms of service
> - ✅ **Future-proof** - Automatically benefits from Notion API improvements
> - ✅ **Transparent** - Explicit permission model through integrations
>
> You control exactly what data the extension can access through integrations.

## 🚀 Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for **"Notion-VSCode"**
4. Click Install

## ✅ Quick Start

1. Create a Notion integration on [notion.com/integrations](https://www.notion.so/my-integrations)
2. Copy the **integration API key** from your integration settings
3. Grant the integration access to your pages
   (In Notion: Open a page → Click `⋯` (top right) → Connections → Select your integration)
4. Open VS Code Settings (macOS: Cmd+, / Windows, Linux: Ctrl+,) and set:
   - **Notion: Api Key** - Your integration's authentication token
   - **Notion: Cache Ttl Days** - Cache duration
   - **Notion: Root Page** - Starting page/database ID
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
