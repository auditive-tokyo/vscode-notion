import "reflect-metadata/lite";
import { Extension } from "vedk";
import * as vscode from "vscode";

import { NotionApiClient } from "./notion-api-client";
import { NotionWebviewPanelSerializer } from "./notion-webview-panel-serializer";
import { OpenPageCommand } from "./open-page-command";
import {
  RecentsStateProvider,
  RecentsTreeDataProvider,
  RecentsTreeView,
} from "./recents";
import { NotionTreeDataProvider } from "./notion-tree-provider";

const extension = new Extension({
  entries: [
    NotionApiClient,
    NotionWebviewPanelSerializer,
    OpenPageCommand,
    // Recents
    RecentsStateProvider,
    RecentsTreeDataProvider,
    RecentsTreeView,
  ],
});

// グローバル状態でNotionClientを保存
let globalNotionClient: NotionApiClient | null = null;

export async function activate(context: vscode.ExtensionContext) {
  // API キー読み込みログ
  const config = vscode.workspace.getConfiguration("notion");
  const apiKey = config.get<string>("apiKey", "");
  console.log(
    "[notion-extension] ✓ API Key loaded:",
    apiKey ? "***" + apiKey.slice(-8) : "NOT SET",
  );

  await extension.activate(context);

  // NotionApiClientを作成（vedkコンテナから取得したい場合は別途対応）
  globalNotionClient = new NotionApiClient();

  // TreeDataProviderを初期化
  const treeDataProvider = new NotionTreeDataProvider(
    globalNotionClient,
    context.globalStorageUri,
  );
  await treeDataProvider.initialize();
  console.log("[notion-extension] ✓ TreeDataProvider initialized");

  // TreeViewを登録
  const treeView = vscode.window.createTreeView("notion-hierarchy", {
    treeDataProvider,
    showCollapseAll: true,
  });
  console.log("[notion-extension] ✓ TreeView registered");

  context.subscriptions.push(treeView);

  // ルートページID設定時にコンテキストを更新
  const updateHierarchyContext = () => {
    const config = vscode.workspace.getConfiguration("notion");
    const rootPageId = config.get<string>("rootPageId", "");
    console.log(
      "[notion-extension] ✓ rootPageId:",
      rootPageId ? rootPageId.slice(0, 16) + "..." : "NOT SET",
    );
    vscode.commands.executeCommand(
      "setContext",
      "notion:hierarchyEnabled",
      !!rootPageId,
    );
  };

  updateHierarchyContext();

  // 設定変更をリッスン
  vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("notion.apiKey")) {
        const config = vscode.workspace.getConfiguration("notion");
        const newApiKey = config.get<string>("apiKey", "");
        console.log(
          "[notion-extension] ✓ API Key updated:",
          newApiKey ? "***" + newApiKey.slice(-8) : "NOT SET",
        );
      }
      if (event.affectsConfiguration("notion.rootPageId")) {
        console.log("[notion-extension] ✓ Root Page ID updated");
        treeDataProvider.refresh();
        updateHierarchyContext();
      }
    },
    null,
    context.subscriptions,
  );

  // リフレッシュコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand("notion.hierarchy.refresh", () => {
      console.log("[notion-extension] Refreshing Notion hierarchy...");
      treeDataProvider.refresh();
    }),
  );
}
