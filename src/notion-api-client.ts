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
   * ページデータをMarkdownで取得
   * 公式APIを使用してページとデータベースの両方に対応
   */
  async getPageDataById(id: string): Promise<string> {
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
  private async getPageOrDatabaseWithOfficialApi(id: string): Promise<string> {
    if (!this.officialClient) {
      throw new Error("Official API client is not configured");
    }

    const cleanId = id.replace(/-/g, "");

    // ページとデータベースの両方を同時に試す
    const [pageResult, databaseResult] = await Promise.allSettled([
      this.officialClient.pages.retrieve({ page_id: cleanId }),
      this.officialClient.databases.retrieve({ database_id: cleanId }),
    ]);

    if (pageResult.status === "fulfilled") {
      console.log("[notion-api-client] Retrieved as page");
      return convertPageToMarkdownHelper(
        pageResult.value,
        this.getPageBlocksRecursive.bind(this),
      );
    } else if (databaseResult.status === "fulfilled") {
      console.log("[notion-api-client] Retrieved as database");
      return convertDatabaseToMarkdownHelper(
        databaseResult.value,
        this.queryDatabaseRows.bind(this),
      );
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

        // @ts-ignore - dataSources.query は型定義に含まれていないが実行時に存在する
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

        allBlocks.push(...response.results);

        if (!response.has_more) {
          break;
        }
        cursor = response.next_cursor || undefined;
      }

      return allBlocks;
    } catch (error) {
      throw new Error(
        `Failed to retrieve blocks: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
