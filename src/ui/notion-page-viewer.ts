import { nanoid } from "nanoid";
import { InjectContext, Injectable, OnExtensionBootstrap } from "vedk";
import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CommandId,
  ViewType,
  configurationPrefix,
  untitledPageTitle,
} from "../constants";
import { NotionApiClient } from "../notion-api-client";
import { getCacheTtlMs } from "../lib/cache-utils";
import { NotionHierarchyTreeView } from "./notion-hierarchy-tree-view";

/**
 * Notion Property の基本型定義
 */
export interface NotionProperty {
  type: string;
  [key: string]: unknown;
}

/**
 * State that gets serialized and passed into webview.
 */
export type NotionWebviewState = {
  id: string;
  title: string;
  data: string; // Markdown
  type?: "database" | "page";
  tableData?: {
    columns: string[];
    rows: {
      id: string;
      cells: string[];
    }[];
    properties?: Record<string, NotionProperty>; // Property定義（status/select判定用）
  };
  viewType?: "table" | "calendar" | "timeline"; // For full-page databases
  datePropertyName?: string; // For full-page databases
  statusColorMap?: Record<string, string>; // Status名 -> 色コード (for full-page databases)
  viewModes?: Record<string, "calendar" | "timeline" | "table" | "board">; // User's view mode selections
  inlineDatabases?: {
    databaseId: string;
    title: string;
    viewType: "table" | "calendar" | "timeline";
    datePropertyName?: string;
    statusColorMap?: Record<string, string>; // Status名 -> 色コード
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
      properties?: Record<string, NotionProperty>; // Property定義（status/select判定用）
    };
  }[];
  coverUrl?: string | null;
  icon?: { type: string; emoji?: string; url?: string } | null;
  description?: string | null;
};

class CachedNotionWebview implements vscode.Disposable {
  constructor(
    public webviewPanel: vscode.WebviewPanel,
    public state: NotionWebviewState,
    private readonly extraDisposables: vscode.Disposable,
  ) {}

  dispose() {
    this.extraDisposables.dispose();
    this.webviewPanel.dispose();
  }

  reveal() {
    this.webviewPanel.reveal();
  }
}

@Injectable()
export class NotionWebviewPanelSerializer
  implements
    vscode.WebviewPanelSerializer,
    vscode.Disposable,
    OnExtensionBootstrap
{
  private readonly cache = new Map<string, CachedNotionWebview>();
  private readonly disposable: vscode.Disposable;
  private readonly pageCacheDir: string;

  constructor(
    @InjectContext() private readonly context: vscode.ExtensionContext,
    private readonly notionApi: NotionApiClient,
  ) {
    this.pageCacheDir = path.join(
      this.context.globalStorageUri.fsPath,
      "page-cache",
    );
    this.disposable = vscode.Disposable.from(
      vscode.commands.registerCommand(
        CommandId.RefreshPage,
        this.refreshActivePage,
        this,
      ),
      // Development only: キャッシュクリアコマンド（開発時のデバッグ用）
      vscode.commands.registerCommand("notion.clearCache", () => {
        this.cache.forEach((cached) => cached.dispose());
        this.cache.clear();
        vscode.window.showInformationMessage("Notion page cache cleared");
      }),
      vscode.window.registerWebviewPanelSerializer(
        ViewType.NotionPageView,
        this,
      ),
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration(configurationPrefix)) {
          await this.rerenderCachedWebviews();
        }
      }),
    );
  }

  dispose() {
    this.disposable.dispose();
  }

  async onExtensionBootstrap() {
    await this.initializeCache();
  }

  /**
   * キャッシュディレクトリを初期化
   */
  private async initializeCache(): Promise<void> {
    try {
      await fs.mkdir(this.pageCacheDir, { recursive: true });
    } catch {
      // 既に存在する場合は無視
    }
  }

  /**
   * ページデータをディスクキャッシュから読み込み
   */
  private async loadPageFromDiskCache(
    id: string,
  ): Promise<NotionWebviewState | null> {
    const cacheFile = path.join(this.pageCacheDir, `${id}.json`);
    try {
      const content = await fs.readFile(cacheFile, "utf-8");
      const cacheData = JSON.parse(content) as {
        timestamp: number;
        state: NotionWebviewState;
      };

      const cacheAgeMs = Date.now() - cacheData.timestamp;
      if (cacheAgeMs > getCacheTtlMs()) {
        await fs.unlink(cacheFile).catch(() => {});
        return null;
      }

      // アクセス時にタイムスタンプを更新（LRU的な挙動）
      await this.savePageToDiskCache(id, cacheData.state);
      return cacheData.state;
    } catch {
      return null;
    }
  }

  /**
   * ページデータをディスクキャッシュに保存
   */
  private async savePageToDiskCache(
    id: string,
    state: NotionWebviewState,
  ): Promise<void> {
    const cacheFile = path.join(this.pageCacheDir, `${id}.json`);
    try {
      const cacheData = {
        timestamp: Date.now(),
        state,
      };
      await fs.writeFile(cacheFile, JSON.stringify(cacheData), "utf-8");
    } catch (error) {
      console.error(`[notion-page-viewer] Failed to save cache: ${id}`, error);
    }
  }

  async createOrShowPage(id: string) {
    const cached = this.cache.get(id);
    if (cached) {
      cached.reveal();
      // キャッシュから復元した場合もTreeViewとシンク
      await this.revealInTreeView(id);
      return;
    }

    // まずディスクキャッシュから読み込み
    let state = await this.loadPageFromDiskCache(id);
    if (!state) {
      // キャッシュがなければAPIから取得
      state = await this.fetchDataAndGetPageState(id);
      await this.savePageToDiskCache(id, state);
    }

    const webviewPanel = vscode.window.createWebviewPanel(
      ViewType.NotionPageView,
      state.title,
      { viewColumn: vscode.ViewColumn.Active },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableCommandUris: [CommandId.OpenPage],
      },
    );

    await this.deserializeWebviewPanel(webviewPanel, state);

    // ページを開いたらTreeViewとシンク
    await this.revealInTreeView(id);
  }

  async deserializeWebviewPanel(
    webviewPanel: vscode.WebviewPanel,
    state?: NotionWebviewState,
  ) {
    if (!state) return;

    const notionPage = new CachedNotionWebview(
      webviewPanel,
      state,
      vscode.Disposable.from(
        webviewPanel.onDidDispose(() => {
          const cached = this.cache.get(state.id);
          if (cached) {
            cached.dispose();
            this.cache.delete(state.id);
          }
        }, this),
        // タブがアクティブになった時にTreeViewとシンク
        webviewPanel.onDidChangeViewState((e) => {
          if (e.webviewPanel.active) {
            void this.revealInTreeView(state.id);
          }
        }),
        // Webviewからのメッセージを受け取る
        webviewPanel.webview.onDidReceiveMessage(
          async (message: {
            command: string;
            viewModes?: Record<string, string>;
          }) => {
            if (message.command === "saveViewModes" && message.viewModes) {
              // viewModesをディスク cache にマージして保存
              const updatedState: NotionWebviewState = {
                ...state,
                viewModes: message.viewModes as Record<
                  string,
                  "calendar" | "timeline" | "table" | "board"
                >,
              };
              await this.savePageToDiskCache(state.id, updatedState);
            }
          },
        ),
      ),
    );

    this.renderWebview(notionPage.webviewPanel, state);
    this.cache.set(state.id, notionPage);
  }

  /**
   * TreeView で該当ページを選択（展開済みの場合のみ）
   */
  private async revealInTreeView(pageId: string): Promise<void> {
    try {
      const hierarchyTreeView = NotionHierarchyTreeView.getInstance();
      const treeView = hierarchyTreeView?.getTreeView();
      const dataProvider = hierarchyTreeView?.getDataProvider();

      if (!treeView || !dataProvider) {
        return;
      }

      // itemCacheからアイテムを取得（展開済みの場合のみ）
      const treeItem =
        dataProvider.getItemById(pageId) ||
        (await dataProvider.ensureItemVisible(pageId));
      if (!treeItem) {
        return;
      }

      // TreeViewで該当アイテムを選択
      await treeView.reveal(treeItem, {
        focus: false, // ページにフォーカスを残す
        select: true,
        expand: true,
      });
    } catch (error) {
      console.error("[notion-page-viewer] Could not sync tree view:", error);
    }
  }

  private async refreshActivePage() {
    let activePage: [string, CachedNotionWebview] | undefined;
    for (const cache of this.cache) {
      if (cache[1].webviewPanel.active) {
        activePage = cache;
        break;
      }
    }

    if (!activePage) return;
    const [id, cache] = activePage;

    // APIから最新データを取得してキャッシュも更新
    const state = await this.fetchDataAndGetPageState(id);
    await this.savePageToDiskCache(id, state);
    this.renderWebview(cache.webviewPanel, state);

    // Tree 上で reveal + expand
    const { NotionHierarchyTreeView } = await import(
      "./notion-hierarchy-tree-view"
    );
    const hierarchyView = NotionHierarchyTreeView.getInstance();
    const treeView = hierarchyView?.getTreeView();
    const dataProvider = hierarchyView?.getDataProvider();
    if (treeView && dataProvider) {
      // TreeView のキャッシュもクリア（子ページリストを再取得）
      await dataProvider.refreshItem(id);

      const treeItem = dataProvider.getItemById(id);
      if (treeItem) {
        await treeView.reveal(treeItem, {
          select: true,
          focus: false,
          expand: true,
        });
      }
    }
  }

  private async rerenderCachedWebviews() {
    for (const [id, cache] of this.cache.entries()) {
      // 古いキャッシュを破棄して新たにデータを取得
      const freshState = await this.fetchDataAndGetPageState(id);
      cache.state = freshState;
      this.renderWebview(cache.webviewPanel, freshState);
    }
  }

  private async fetchDataAndGetPageState(id: string) {
    const result = await vscode.window.withProgress(
      {
        title: "VSCode Notion",
        location: vscode.ProgressLocation.Notification,
      },
      async (progress, _) => {
        progress.report({ message: "Loading..." });
        return this.notionApi.getPageDataById(id);
      },
    );
    // Markdown の最初のヘッダーからタイトルを抽出
    const title =
      this.extractTitleFromMarkdown(result.data) ?? untitledPageTitle;
    const finalState: NotionWebviewState = {
      id,
      title,
      data: result.data,
      type: result.type,
      ...(result.tableData && { tableData: result.tableData }),
      ...(result.viewType && { viewType: result.viewType }),
      ...(result.datePropertyName && {
        datePropertyName: result.datePropertyName,
      }),
      ...(result.statusColorMap && { statusColorMap: result.statusColorMap }),
      coverUrl: result.coverUrl ?? null,
      icon: result.icon ?? null,
      description: result.description ?? null,
      inlineDatabases: result.inlineDatabases ?? [],
    };
    return finalState;
  }

  /**
   * Markdown の最初の # ヘッダーを抽出
   */
  private extractTitleFromMarkdown(markdown: string): string | null {
    const lines = markdown.split("\n");
    for (const line of lines) {
      const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (normalizedLine.startsWith("# ")) {
        return normalizedLine.slice(2).trim();
      }
    }
    return null;
  }

  private renderWebview(
    webviewPanel: vscode.WebviewPanel,
    state: NotionWebviewState,
  ) {
    const nonce = nanoid();
    const extensionUri = this.context.extensionUri;
    const cspSource = webviewPanel.webview.cspSource;

    const frameSrcCsp = "https:";

    const reactWebviewUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "dist/webview.js"),
    );

    webviewPanel.webview.html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy" 
      content="frame-src ${frameSrcCsp}; default-src 'none';  style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} https:; script-src 'nonce-${nonce}';"
    />
</head>
<body class="vscode-body">
    <div id="root"></div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      vscode.setState(${JSON.stringify(state)});
      window.vscode = vscode;
    </script>
    <script nonce="${nonce}" src="${reactWebviewUri}"></script>
</body>
</html>`;
  }
}
