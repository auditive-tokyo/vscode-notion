import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import { NotionApiClient } from "../notion-api-client";
import {
  extractPagesAndDatabases,
  NotionPageTreeItem,
} from "../notion-api-utils/page-discovery";
import { CommandId } from "../constants";
import { OpenPageCommandArgs } from "./open-page-command";
import { getCacheTtlMs } from "../lib/cache-utils";
import { extractPageId } from "../lib/page-id-utils";

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
  // 親ノードを保持するマップ: 子ノードのID → 親ノード
  private parentMap: Map<string, NotionPageTreeItem> = new Map();
  // すべてのアイテムをキャッシュ: アイテムID → NotionPageTreeItem
  private itemCache: Map<string, NotionPageTreeItem> = new Map();

  constructor(notionClient: NotionApiClient, globalStorageUri: vscode.Uri) {
    this.notionClient = notionClient;
    this.cacheDir = path.join(globalStorageUri.fsPath, "notion-cache");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  async refresh(): Promise<void> {
    this.cache.clear();
    this.parentMap.clear();
    this.itemCache.clear();
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

  /**
   * 特定のアイテムのみ更新（子ページ再取得）
   */
  async refreshItem(pageId: string): Promise<void> {
    // そのページのキャッシュをクリア
    this.cache.delete(pageId);

    // ディスクキャッシュも削除
    const cacheFile = path.join(this.cacheDir, `${pageId}.json`);
    try {
      await fs.unlink(cacheFile);
      console.log("[notion-tree] Item cache cleared:", pageId);
    } catch {
      // ファイルがなければ無視
    }

    // そのアイテムの変更を通知（子を再取得させる）
    const item = this.itemCache.get(pageId);
    if (item) {
      this._onDidChangeTreeData.fire(item);
    } else {
      // アイテムがなければツリー全体を更新
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * ID からアイテムを取得
   */
  getItemById(id: string): NotionPageTreeItem | undefined {
    return this.itemCache.get(id);
  }

  /**
   * 親チェーンを辿ってTreeViewで選択できる状態にする
   */
  async ensureItemVisible(pageId: string): Promise<NotionPageTreeItem | null> {
    console.log("[notion-tree] ensureItemVisible called with pageId:", pageId);

    if (!this.notionClient.isConfigured()) {
      return null;
    }

    const config = vscode.workspace.getConfiguration("notion");
    const rawRootPage =
      config.get<string>("rootPage", "") ||
      config.get<string>("rootPageId", "");
    const rootPageId = extractPageId(rawRootPage);
    if (!rootPageId) {
      return null;
    }

    const normalizeId = (value: string) => value.replace(/-/g, "");
    const rootNormalized = normalizeId(rootPageId);

    // ルートを先にキャッシュしておく
    try {
      await this.getChildren();
    } catch {
      // ルート取得失敗は無視
    }

    const chain = await this.getAncestorChain(pageId, rootNormalized);
    console.log(
      "[notion-tree] Ancestor chain:",
      chain?.map((c) => ({ id: c.id, title: c.title })) || null,
    );

    if (!chain || chain.length === 0) {
      return null;
    }

    // ルートから順に子要素を取得し、parentMap/itemCacheを構築
    for (let i = 0; i < chain.length - 1; i += 1) {
      const parent = chain[i]!;
      const child = chain[i + 1]!;
      const children = await this.getChildren(parent);
      const match = children.find((item) => item.id === child.id);
      if (!match) {
        console.log(
          `[notion-tree] Child ${child.id} not found under ${parent.id}`,
        );
        return null;
      }
    }

    return this.getItemById(pageId) ?? chain[chain.length - 1] ?? null;
  }

  private async getAncestorChain(
    pageId: string,
    rootNormalized: string,
  ): Promise<NotionPageTreeItem[] | null> {
    const chain: NotionPageTreeItem[] = [];
    const seen = new Set<string>();
    const normalizeId = (value: string) => value.replace(/-/g, "");

    let currentId: string | undefined = pageId;
    let guard = 0;

    while (currentId && guard < 50) {
      guard += 1;
      const normalized = normalizeId(currentId);
      if (seen.has(normalized)) {
        return null;
      }
      seen.add(normalized);

      const info = await this.fetchItemInfoWithParent(currentId);
      if (!info) {
        return null;
      }

      chain.push(info.item);

      const itemNormalized = normalizeId(info.item.id);
      if (itemNormalized === rootNormalized) {
        break;
      }

      if (!info.parentId) {
        return null;
      }
      currentId = info.parentId;
    }

    if (chain.length === 0) {
      return null;
    }

    chain.reverse();
    return chain;
  }

  private async fetchItemInfoWithParent(pageId: string): Promise<{
    item: NotionPageTreeItem;
    parentId?: string;
  } | null> {
    try {
      const officialClient = (this.notionClient as any).officialClient;
      if (!officialClient) {
        return null;
      }

      const getParentId = (parent: any): string | undefined => {
        console.log(
          "[notion-tree] Raw parent object:",
          JSON.stringify(parent, null, 2),
        );

        if (!parent || typeof parent !== "object") {
          console.log("[notion-tree] Parent is null or not an object");
          return undefined;
        }
        if (parent.type === "page_id") {
          return parent.page_id;
        }
        if (parent.type === "database_id") {
          return parent.database_id;
        }
        if (parent.type === "data_source_id") {
          // データベースレコードの場合、database_id を返す
          return parent.database_id;
        }
        if (parent.type === "block_id") {
          return parent.block_id;
        }
        console.log("[notion-tree] Parent type not recognized:", parent.type);
        return undefined;
      };

      // まずページとして取得を試みる
      try {
        const page = await officialClient.pages.retrieve({ page_id: pageId });
        let title = "Untitled";
        const properties = (page as any).properties || {};
        for (const [, value] of Object.entries(properties)) {
          const prop = value as any;
          if (prop.type === "title" && prop.title?.length > 0) {
            title = prop.title.map((t: any) => t.plain_text).join("");
            break;
          }
        }

        const parentId = getParentId((page as any).parent);
        console.log("[notion-tree] Parent ID retrieved (page):", parentId);

        const item: NotionPageTreeItem = {
          id: page.id,
          title,
          type: "page",
        };
        return parentId ? { item, parentId } : { item };
      } catch (pageError) {
        // データベースとして取得を試みる
        try {
          const database = await officialClient.databases.retrieve({
            database_id: pageId,
          });

          const title =
            (database as any).title?.map((t: any) => t.plain_text).join("") ||
            "Untitled Database";

          const parentId = getParentId((database as any).parent);
          console.log(
            "[notion-tree] Parent ID retrieved (database):",
            parentId,
          );

          const item: NotionPageTreeItem = {
            id: database.id,
            title,
            type: "database",
          };
          return parentId ? { item, parentId } : { item };
        } catch {
          throw pageError;
        }
      }
    } catch (error) {
      console.error(
        `[notion-tree] Failed to fetch parent info for ${pageId}:`,
        error,
      );
      return null;
    }
  }

  async getTreeItem(element: NotionPageTreeItem): Promise<vscode.TreeItem> {
    // ページとデータベースは展開可能（子がいるか lazy load で確認）
    const treeItem = new vscode.TreeItem(
      element.title,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    // アイコンを設定（VSCodeのビルトインアイコン使用）
    treeItem.iconPath = new vscode.ThemeIcon(
      element.type === "database" ? "database" : "file",
    );
    treeItem.contextValue = element.type; // コンテキストメニュー用

    // クリックでページを開くコマンドを設定（element全体を渡してreveal用に使う）
    treeItem.command = {
      command: CommandId.OpenPage,
      title: "Open page",
      arguments: [
        { id: element.id, treeItem: element } satisfies OpenPageCommandArgs,
      ],
    };

    console.log(
      `[notion-tree] getTreeItem: ${element.title} (${element.type})`,
    );
    return treeItem;
  }

  getParent(element: NotionPageTreeItem): NotionPageTreeItem | null {
    const parent = this.parentMap.get(element.id);
    return parent || null;
  }

  async getChildren(
    element?: NotionPageTreeItem,
  ): Promise<NotionPageTreeItem[]> {
    console.log("[notion-tree] getChildren called", {
      element: element?.title,
      type: element?.type,
    });

    if (!this.notionClient.isConfigured()) {
      console.log("[notion-tree] notionClient not configured");
      return [];
    }

    if (!element) {
      // ルートページを取得（設定から）
      const config = vscode.workspace.getConfiguration("notion");
      const rawRootPage =
        config.get<string>("rootPage", "") ||
        config.get<string>("rootPageId", "");
      const rootPageId = extractPageId(rawRootPage);

      console.log("[notion-tree] rootPage:", rootPageId);

      if (!rootPageId) {
        console.log("[notion-tree] rootPage not set");
        return [];
      }

      try {
        // ルートページ自体を取得して表示
        console.log("[notion-tree] Fetching root page info...");
        const rootPage = await this.fetchPageInfo(rootPageId);
        if (rootPage) {
          this.itemCache.set(rootPage.id, rootPage);
          console.log("[notion-tree] Root page:", rootPage.title);
          return [rootPage];
        }
        return [];
      } catch (error) {
        console.error("[notion-tree] Failed to fetch root page:", error);
        return [];
      }
    }

    // データベースの場合はレコードを取得、ページの場合は子ページを取得
    try {
      console.log(
        `[notion-tree] Fetching children for element: ${element.title} (type: ${element.type})`,
      );
      const children = await this.fetchPageChildren(element.id, element.type);
      console.log(
        `[notion-tree] Children for ${element.title}:`,
        children.length,
      );
      // 親情報を記録
      for (const child of children) {
        this.parentMap.set(child.id, element);
      }
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
    type: "page" | "database" = "page",
  ): Promise<NotionPageTreeItem[]> {
    // キャッシュを確認
    const cacheKey = `${type}:${pageId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || [];
    }

    try {
      // ディスクキャッシュを確認
      const cachedData = await this.loadFromCache(cacheKey);
      if (cachedData) {
        this.cache.set(cacheKey, cachedData);
        return cachedData;
      }

      let children: NotionPageTreeItem[] = [];

      // アイテムをキャッシュに追加するヘルパー
      const addToItemCache = (items: NotionPageTreeItem[]) => {
        for (const item of items) {
          this.itemCache.set(item.id, item);
        }
      };

      if (type === "database") {
        // データベースの場合はレコードを取得
        console.log(`[notion-tree] Fetching database records for ${pageId}`);
        children = await this.fetchDatabaseRecords(pageId);
        console.log(`[notion-tree] Found ${children.length} database records`);
        addToItemCache(children);
      } else {
        // ページの場合はブロックから子ページ/DBを探索
        console.log(`[notion-tree] Fetching children for page ${pageId}`);
        const blocks = await this.getPageBlocks(pageId);
        console.log(`[notion-tree] Found ${blocks.length} blocks`);

        const seenIds = new Set<string>();

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
        addToItemCache(children);
      }

      // キャッシュに保存
      await this.saveToCache(cacheKey, children);
      this.cache.set(cacheKey, children);

      return children;
    } catch (error) {
      console.error(
        `[notion-tree] Error fetching children for ${pageId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * ページの基本情報を取得
   */
  private async fetchPageInfo(
    pageId: string,
  ): Promise<NotionPageTreeItem | null> {
    try {
      const officialClient = (this.notionClient as any).officialClient;
      if (!officialClient) {
        return null;
      }

      // まずページとして取得を試みる
      try {
        const page = await officialClient.pages.retrieve({ page_id: pageId });

        // タイトルを取得
        let title = "Untitled";
        const properties = (page as any).properties || {};

        // Title プロパティを探す
        for (const [, value] of Object.entries(properties)) {
          const prop = value as any;
          if (prop.type === "title" && prop.title?.length > 0) {
            title = prop.title.map((t: any) => t.plain_text).join("");
            break;
          }
        }

        return {
          id: page.id,
          title,
          type: "page",
        };
      } catch (pageError) {
        // ページとして取得失敗時、データベースとして取得を試みる
        console.log(
          `[notion-tree] Page retrieval failed for ${pageId}, trying database API...`,
        );
        try {
          const database = await officialClient.databases.retrieve({
            database_id: pageId,
          });

          const title =
            (database as any).title?.map((t: any) => t.plain_text).join("") ||
            "Untitled Database";

          return {
            id: database.id,
            title,
            type: "database",
          };
        } catch {
          // データベースとしても失敗時、元のエラーを投げる
          throw pageError;
        }
      }
    } catch (error) {
      console.error(
        `[notion-tree] Failed to fetch page info for ${pageId}:`,
        error,
      );
      return null;
    }
  }

  private async fetchDatabaseRecords(
    databaseId: string,
  ): Promise<NotionPageTreeItem[]> {
    try {
      console.log(`[notion-tree] Fetching database records for ${databaseId}`);

      // NotionApiClient の公開メソッドを使用
      const records = await this.notionClient.getDatabaseRecords(databaseId);

      // NotionPageTreeItem 形式に変換
      const treeItems: NotionPageTreeItem[] = records.map((record) => ({
        id: record.id,
        title: record.title,
        type: "page", // データベースレコードは page として扱う
      }));

      console.log(
        `[notion-tree] Fetched ${treeItems.length} records from database ${databaseId}`,
      );
      return treeItems;
    } catch (error) {
      console.error(
        `[notion-tree] Failed to fetch database records for ${databaseId}:`,
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

      if (cacheAgeMs > getCacheTtlMs()) {
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
