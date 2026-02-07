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
  await extension.activate(context);
}
