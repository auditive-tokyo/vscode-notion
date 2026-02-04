import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { NotionApiClient } from "../notion-api-client";
import {
  extractPagesAndDatabases,
  NotionPageTreeItem,
} from "../notion-api-utils/page-discovery";

export class NotionTreeDataProvider
  implements vscode.TreeDataProvider<NotionPageTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    NotionPageTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private notionClient: NotionApiClient;
  private cache: Map<string, NotionPageTreeItem[]> = new Map();
  private cacheDir: string;

  constructor(notionClient: NotionApiClient, globalStorageUri: vscode.Uri) {
    this.notionClient = notionClient;
    this.cacheDir = path.join(globalStorageUri.fsPath, "notion-cache");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  async refresh(): Promise<void> {
    this.cache.clear();
    // ディスクキャッシュもクリア
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log("[notion-tree] Cache cleared");
    } catch (error) {
      console.error("[notion-tree] Failed to clear cache:", error);
    }
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: NotionPageTreeItem): Promise<vscode.TreeItem> {
    const treeItem = new vscode.TreeItem(
      element.title,
      vscode.TreeItemCollapsibleState.Collapsed, // 常に展開可能にする
    );

    // アイコンを設定（VSCodeのビルトインアイコン使用）
    treeItem.iconPath = new vscode.ThemeIcon(
      element.type === "database" ? "database" : "file",
    );
    treeItem.contextValue = element.type; // コンテキストメニュー用

    console.log(
      `[notion-tree] getTreeItem: ${element.title} (${element.type})`,
    );
    return treeItem;
  }

  async getChildren(
    element?: NotionPageTreeItem,
  ): Promise<NotionPageTreeItem[]> {
    console.log("[notion-tree] getChildren called", {
      element: element?.title,
    });

    if (!this.notionClient.isConfigured()) {
      console.log("[notion-tree] notionClient not configured");
      return [];
    }

    if (!element) {
      // ルートページを取得（設定から）
      const config = vscode.workspace.getConfiguration("notion");
      const rootPageId = config.get<string>("rootPageId", "");

      console.log("[notion-tree] rootPageId:", rootPageId);

      if (!rootPageId) {
        console.log("[notion-tree] rootPageId not set");
        return [];
      }

      try {
        console.log("[notion-tree] Fetching root page children...");
        const children = await this.fetchPageChildren(rootPageId);
        console.log(
          "[notion-tree] Root page children fetched:",
          children.length,
        );
        return children;
      } catch (error) {
        console.error("[notion-tree] Failed to fetch root children:", error);
        return [];
      }
    }

    // 子ページを取得
    try {
      console.log(
        `[notion-tree] Fetching children for element: ${element.title}`,
      );
      const children = await this.fetchPageChildren(element.id);
      console.log(
        `[notion-tree] Children for ${element.title}:`,
        children.length,
      );
      return children;
    } catch (error) {
      console.error(
        `[notion-tree] Failed to fetch children for ${element.id}:`,
        error,
      );
      return [];
    }
  }

  private async fetchPageChildren(
    pageId: string,
  ): Promise<NotionPageTreeItem[]> {
    // キャッシュを確認
    if (this.cache.has(pageId)) {
      return this.cache.get(pageId) || [];
    }

    try {
      // ディスクキャッシュを確認
      const cachedData = await this.loadFromCache(pageId);
      if (cachedData) {
        this.cache.set(pageId, cachedData);
        return cachedData;
      }

      // Notionから取得
      const blocks = await this.getPageBlocks(pageId);
      const children: NotionPageTreeItem[] = [];
      const seenIds = new Set<string>();

      console.log(`[notion-tree] Fetching children for page ${pageId}`);
      console.log(`[notion-tree] Found ${blocks.length} blocks`);

      // ブロック内のすべてのページ/DBを再帰的に探索
      for (const block of blocks) {
        console.log(`[notion-tree] Processing block type: ${block.type}`);
        const foundItems = extractPagesAndDatabases(block);
        console.log(
          `[notion-tree] Found ${foundItems.length} items from ${block.type}`,
          foundItems,
        );
        for (const item of foundItems) {
          // 重複を避ける
          if (!seenIds.has(item.id)) {
            children.push(item);
            seenIds.add(item.id);
          }
        }
      }

      console.log(
        `[notion-tree] Total children for page: ${children.length}`,
        children,
      );

      // キャッシュに保存
      await this.saveToCache(pageId, children);
      this.cache.set(pageId, children);

      return children;
    } catch (error) {
      console.error(
        `[notion-tree] Error fetching children for ${pageId}:`,
        error,
      );
      return [];
    }
  }

  private async getPageBlocks(pageId: string): Promise<any[]> {
    const officialClient = (this.notionClient as any).officialClient;
    if (!officialClient) {
      return [];
    }

    const allBlocks: any[] = [];
    let cursor: string | undefined;

    try {
      while (true) {
        const params: any = {
          block_id: pageId,
          page_size: 100,
        };
        if (cursor) {
          params.start_cursor = cursor;
        }

        const response = await officialClient.blocks.children.list(params);
        allBlocks.push(...response.results);

        if (!response.has_more) {
          break;
        }
        cursor = response.next_cursor || undefined;
      }

      return allBlocks;
    } catch (error) {
      console.error("[notion-tree] Failed to get page blocks:", error);
      return [];
    }
  }

  private getCachePath(pageId: string): string {
    const cleanId = pageId.replace(/-/g, "");
    return path.join(this.cacheDir, `${cleanId}.json`);
  }

  private async loadFromCache(
    pageId: string,
  ): Promise<NotionPageTreeItem[] | null> {
    try {
      const cachePath = this.getCachePath(pageId);
      const data = await fs.readFile(cachePath, "utf-8");

      const cacheData = JSON.parse(data) as {
        timestamp: number;
        data: NotionPageTreeItem[];
      };

      // タイムスタンプの妥当性をチェック
      if (!cacheData.timestamp || typeof cacheData.timestamp !== "number") {
        console.warn(
          `[notion-tree] Invalid cache format for ${pageId}, removing old cache`,
        );
        await this.deleteCache(pageId);
        return null;
      }

      const now = Date.now();
      const cacheAgeMs = now - cacheData.timestamp;
      const TTL_MS = 24 * 60 * 60 * 1000; // 24時間

      if (cacheAgeMs > TTL_MS) {
        console.log(
          `[notion-tree] Cache for ${pageId} expired (${Math.round(
            cacheAgeMs / 1000 / 60,
          )} minutes old), removing`,
        );
        await this.deleteCache(pageId);
        return null;
      }

      console.log(
        `[notion-tree] Cache for ${pageId} is valid (${Math.round(
          cacheAgeMs / 1000 / 60,
        )} minutes old)`,
      );
      return cacheData.data;
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        // ファイルが存在しない場合は正常系
        return null;
      }
      console.error(`[notion-tree] Failed to load cache for ${pageId}:`, error);
      return null;
    }
  }

  private async saveToCache(
    pageId: string,
    data: NotionPageTreeItem[],
  ): Promise<void> {
    try {
      const cachePath = this.getCachePath(pageId);
      const cacheData = {
        timestamp: Date.now(),
        data,
      };
      await fs.writeFile(
        cachePath,
        JSON.stringify(cacheData, null, 2),
        "utf-8",
      );
      console.log(`[notion-tree] Cache saved for ${pageId}`);
    } catch (error) {
      console.error(`[notion-tree] Failed to save cache for ${pageId}:`, error);
    }
  }

  private async deleteCache(pageId: string): Promise<void> {
    try {
      const cachePath = this.getCachePath(pageId);
      await fs.rm(cachePath, { force: true });
      console.log(`[notion-tree] Cache deleted for ${pageId}`);
    } catch (error) {
      console.error(
        `[notion-tree] Failed to delete cache for ${pageId}:`,
        error,
      );
    }
  }
}
