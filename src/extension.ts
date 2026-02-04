import "reflect-metadata/lite";
import { Extension } from "vedk";
import * as vscode from "vscode";

import { NotionApiClient } from "./notion-api-client";
import { NotionWebviewPanelSerializer } from "./ui/notion-page-viewer";
import { OpenPageCommand } from "./ui/open-page-command";
import { NotionHierarchyTreeView } from "./ui/notion-hierarchy-tree-view";

const extension = new Extension({
  entries: [
    NotionApiClient,
    NotionWebviewPanelSerializer,
    OpenPageCommand,
    // Page Tree
    NotionHierarchyTreeView,
  ],
});

export async function activate(context: vscode.ExtensionContext) {
  // API キー読み込みログ
  const config = vscode.workspace.getConfiguration("notion");
  const apiKey = config.get<string>("apiKey", "");
  console.log(
    "[notion-extension] ✓ API Key loaded:",
    apiKey ? "***" + apiKey.slice(-8) : "NOT SET",
  );

  await extension.activate(context);

  console.log("[notion-extension] ✓ Extension activated");
}
