# Getting Started

## Install

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Notion-VSCode"
4. Click Install

## Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Name your integration (for example, "VSCode Notion")
4. Copy the Internal Integration Token

## Share Pages With Your Integration

1. Open a page you want to view
2. Click "Share" -> "Invite"
3. Search for your integration name and add it

## Connect to VS Code

1. Open VS Code Settings (macOS: Cmd+, / Windows, Linux: Ctrl+,)
2. Search for `notion` and set:
   - **Notion: Api Key** - Paste your integration token
   - **Notion: Cache Ttl Days** - How long to cache loaded pages (default: 7 days)
   - **Notion: Root Page** - Notion page URL or 32-character page/database ID
3. Your Notion workspace appears in the sidebar

## Browse Pages

- Click any page in the tree to view its content
- Switch database view modes (Table, Calendar, Timeline, Board)
- Use `Notion: Open Page` to jump to a page by URL or ID
