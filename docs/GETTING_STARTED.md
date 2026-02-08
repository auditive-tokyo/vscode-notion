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

1. Open VS Code Settings (Cmd+,)
2. Search for `notion`
3. Paste your integration token into `notion.apiKey`
4. Set your root page in `notion.rootPage`
5. Your Notion workspace appears in the sidebar

## Browse Pages

- Click any page in the tree to view its content
- Switch database view modes (Table, Calendar, Timeline, Board)
- Use `Notion: Open Page` to jump to a page by URL or ID
