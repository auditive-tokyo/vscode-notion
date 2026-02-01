import { Client } from "@notionhq/client";
import { Injectable } from "vedk";
import * as vscode from "vscode";
import {
  convertPageToMarkdownHelper,
  convertDatabaseToMarkdownHelper,
} from "./notion-api-utils";

/**
 * Notion APIクライアント
 * 公式API (@notionhq/client) を使用してページとデータベースを取得
 * Markdown変換ロジックは utils に分離
 */
@Injectable()
export class NotionApiClient {
  private officialClient: Client | null = null;

  constructor() {
    this.initializeApiKey();
  }

  /**
   * 初期化時にAPI キーを読み込む
   */
  private initializeApiKey() {
    const config = vscode.workspace.getConfiguration("notion");
    const apiKey = config.get<string>("apiKey", "");
    if (apiKey) {
      this.setApiKey(apiKey);
    }
  }

  /**
   * 公式API キーを設定
   */
  setApiKey(apiKey: string) {
    this.officialClient = new Client({ auth: apiKey });
  }

  /**
   * APIキーが設定されているか確認
   */
  isConfigured(): boolean {
    return this.officialClient !== null;
  }

  /**
   * ページデータをMarkdownで取得（type情報付き）
   * 公式APIを使用してページとデータベースの両方に対応
   */
  async getPageDataById(id: string): Promise<{
    data: string;
    type: "page" | "database";
    tableData?: any;
    coverUrl?: string | null;
    icon?: { type: string; emoji?: string; url?: string } | null;
    description?: string | null;
  }> {
    console.log("[notion-api-client] getPageDataById called with id:", id);

    if (!this.officialClient) {
      throw new Error(
        "Notion API key is not configured. Please set notion.apiKey in settings.",
      );
    }

    try {
      return await this.getPageOrDatabaseWithOfficialApi(id);
    } catch (error) {
      console.error("[notion-api-client] getPageDataById error:", error);
      throw error;
    }
  }

  /**
   * ページまたはデータベースを取得（公式API）
   * Promise.allSettled で両方を同時に試し、どちらが成功するか判定
   */
  private async getPageOrDatabaseWithOfficialApi(id: string): Promise<{
    data: string;
    type: "page" | "database";
    tableData?: any;
    coverUrl?: string | null;
    icon?: { type: string; emoji?: string; url?: string } | null;
    description?: string | null;
  }> {
    if (!this.officialClient) {
      throw new Error("Official API client is not configured");
    }

    const cleanId = id.replace(/-/g, "");

    // ページとデータベースの両方を同時に試す
    const [pageResult, databaseResult] = await Promise.allSettled([
      this.officialClient.pages.retrieve({ page_id: cleanId }),
      this.officialClient.databases.retrieve({ database_id: cleanId }),
    ]);

    // ページを優先（データベースレコードはページとして扱われるため）
    if (pageResult.status === "fulfilled") {
      console.log("[notion-api-client] Retrieved as page");
      const pageData = pageResult.value as any;
      console.log("[notion-api-client] page.icon:", pageData.icon);
      const result = await convertPageToMarkdownHelper(
        pageResult.value,
        this.getPageBlocksRecursive.bind(this),
      );
      return {
        data: result.markdown,
        type: "page",
        coverUrl: result.coverUrl,
        icon: result.icon,
      };
    } else if (databaseResult.status === "fulfilled") {
      console.log("[notion-api-client] Retrieved as database");
      const databaseData = databaseResult.value as any;
      console.log("[notion-api-client] database.description:", JSON.stringify(databaseData.description, null, 2));
      const result = await convertDatabaseToMarkdownHelper(
        databaseResult.value,
        this.queryDatabaseRows.bind(this),
      );
      console.log(
        "[notion-api-client] convertDatabaseToMarkdownHelper result:",
        result,
      );
      return {
        data: result.markdown,
        type: "database",
        tableData: result.tableData,
        coverUrl: result.coverUrl,
        icon: result.icon,
        description: result.description,
      };
    } else {
      throw new Error("Failed to retrieve page or database");
    }
  }

  /**
   * データベースの行を取得
   * Notion API v5では dataSources.query を使用
   */
  private async queryDatabaseRows(databaseId: string): Promise<any[]> {
    if (!this.officialClient) {
      throw new Error("Official API client is not configured");
    }

    try {
      // まずdatabases.retrieveでデータベース情報を取得
      const database: any = await this.officialClient.databases.retrieve({
        database_id: databaseId.replace(/-/g, ""),
      });

      // data_sourcesからIDを取得
      const dataSourceId = database.data_sources?.[0]?.id;
      if (!dataSourceId) {
        console.error("[notion-api-client] No data source found for database");
        return [];
      }

      // dataSources.queryでレコードを取得（ページネーション対応）
      const records: any[] = [];
      let cursor: string | undefined;

      while (true) {
        const params: any = {
          data_source_id: dataSourceId,
          page_size: 100,
        };
        if (cursor) {
          params.start_cursor = cursor;
        }

        const response = await this.officialClient.dataSources.query(params);

        for (const result of response.results) {
          if ("properties" in result) {
            records.push(result);
          }
        }

        if (!response.has_more) {
          break;
        }
        cursor = response.next_cursor ?? undefined;
      }

      return records;
    } catch (error) {
      console.error("[notion-api-client] Failed to query database:", error);
      return [];
    }
  }

  /**
   * ページのブロック一覧を再帰的に取得
   */
  private async getPageBlocksRecursive(pageId: string) {
    if (!this.officialClient) {
      throw new Error("Official API client is not configured");
    }

    console.log(
      "[notion-api-client] getPageBlocksRecursive called with pageId:",
      pageId,
    );
    const allBlocks: any[] = [];
    let cursor: string | undefined = undefined;

    try {
      while (true) {
        const params: any = {
          block_id: pageId,
          page_size: 100,
        };
        if (cursor) {
          params.start_cursor = cursor;
        }
        const response = await this.officialClient.blocks.children.list(params);

        console.log(
          "[notion-api-client] blocks.children.list response:",
          response.results.length,
          "blocks",
        );
        allBlocks.push(...response.results);

        if (!response.has_more) {
          break;
        }
        cursor = response.next_cursor || undefined;
      }

      console.log(
        "[notion-api-client] Total blocks retrieved:",
        allBlocks.length,
      );
      return allBlocks;
    } catch (error) {
      console.error("[notion-api-client] getPageBlocksRecursive error:", error);
      throw new Error(
        `Failed to retrieve blocks: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
