import { Client } from "@notionhq/client";
import { Injectable } from "vedk";
import * as vscode from "vscode";
import {
  convertPageToMarkdownHelper,
  convertDatabaseToMarkdownHelper,
} from "./notion-api-utils";

// Type definitions
type ViewType = "table" | "calendar" | "timeline";

type InlineDatabaseRecord = {
  databaseId: string;
  title: string;
  viewType: ViewType;
  datePropertyName?: string;
  statusColorMap?: Record<string, string>;
  tableData: {
    columns: string[];
    rows: {
      id: string;
      cells: (string | { start: string | null; end: string | null })[];
    }[];
  };
};

type PageOrDatabaseResponse = {
  data: string;
  type: "page" | "database";
  tableData?: any;
  coverUrl?: string | null;
  icon?: { type: string; emoji?: string; url?: string } | null;
  description?: string | null;
  viewType?: ViewType;
  datePropertyName?: string;
  statusColorMap?: Record<string, string>;
  inlineDatabases?: InlineDatabaseRecord[];
};

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
  async getPageDataById(id: string): Promise<PageOrDatabaseResponse> {
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
  private async getPageOrDatabaseWithOfficialApi(
    id: string,
  ): Promise<PageOrDatabaseResponse> {
    if (!this.officialClient) {
      throw new Error("Official API client is not configured");
    }

    const cleanId = id.replaceAll("-", "");

    // ページとデータベースの両方を同時に試す
    const [pageResult, databaseResult] = await Promise.allSettled([
      this.officialClient.pages.retrieve({ page_id: cleanId }),
      this.officialClient.databases.retrieve({ database_id: cleanId }),
    ]);

    // ページを優先（データベースレコードはページとして扱われるため）
    if (pageResult.status === "fulfilled") {
      const result = await convertPageToMarkdownHelper(
        pageResult.value,
        this.getPageBlocksRecursive.bind(this),
        this.queryDatabaseRows.bind(this),
        this.getDatabaseInfo.bind(this),
      );
      const response: PageOrDatabaseResponse = {
        data: result.markdown,
        type: "page",
        coverUrl: result.coverUrl,
        icon: result.icon,
      };
      if (result.inlineDatabases && result.inlineDatabases.length > 0) {
        response.inlineDatabases = result.inlineDatabases;
      }
      return response;
    } else if (databaseResult.status === "fulfilled") {
      const result = await convertDatabaseToMarkdownHelper(
        databaseResult.value,
        this.queryDatabaseRows.bind(this),
      );
      const response: any = {
        data: result.markdown,
        type: "database",
        tableData: result.tableData,
        coverUrl: result.coverUrl,
        icon: result.icon,
        description: result.description,
      };

      // Include viewType and datePropertyName for full-page databases
      if (result.viewType) {
        response.viewType = result.viewType;
      }
      if (result.datePropertyName) {
        response.datePropertyName = result.datePropertyName;
      }
      if (result.statusColorMap) {
        response.statusColorMap = result.statusColorMap;
      }

      return response;
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
        database_id: databaseId.replaceAll("-", ""),
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
   * データベースのレコード（ページ）を取得する公開メソッド
   * ツリービューでデータベースを展開した際に呼び出される
   */
  async getDatabaseRecords(databaseId: string): Promise<
    {
      id: string;
      title: string;
    }[]
  > {
    if (!this.officialClient) {
      throw new Error("Official API client is not configured");
    }

    try {
      // queryDatabaseRows を使用してレコードを取得
      const rawRecords = await this.queryDatabaseRows(databaseId);

      // タイトルを抽出して変換
      const records: { id: string; title: string }[] = [];

      for (const record of rawRecords) {
        if (!record.id) continue;

        // タイトルを抽出（properties.Name または最初の title プロパティ）
        let title = "Untitled";
        const properties = record.properties;

        if (properties) {
          // Name プロパティを優先
          if (properties.Name && properties.Name.type === "title") {
            const titleArray = properties.Name.title;
            if (titleArray && titleArray.length > 0) {
              title = titleArray.map((t: any) => t.plain_text).join("");
            }
          } else {
            // 最初の title 型プロパティを探す
            for (const key of Object.keys(properties)) {
              const prop = properties[key];
              if (prop.type === "title") {
                const titleArray = prop.title;
                if (titleArray && titleArray.length > 0) {
                  title = titleArray.map((t: any) => t.plain_text).join("");
                  break;
                }
              }
            }
          }
        }

        records.push({
          id: record.id,
          title: title || "Untitled",
        });
      }

      return records;
    } catch (error) {
      console.error(
        `[notion-api-client] Failed to get database records:`,
        error,
      );
      throw error;
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
      console.error("[notion-api-client] getPageBlocksRecursive error:", error);
      throw new Error(
        `Failed to retrieve blocks: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * データベース情報を取得（is_inline判定用）
   */
  private async getDatabaseInfo(
    databaseId: string,
  ): Promise<{ is_inline: boolean; title: string }> {
    if (!this.officialClient) {
      throw new Error("Official API client is not configured");
    }

    try {
      const database: any = await this.officialClient.databases.retrieve({
        database_id: databaseId.replaceAll("-", ""),
      });

      const title = database.title?.[0]?.plain_text || "Untitled Database";
      const is_inline = database.is_inline ?? false;

      return { is_inline, title };
    } catch (error) {
      console.error("[notion-api-client] getDatabaseInfo error:", error);
      // エラー時はis_inline: trueとして扱う（テーブル表示）
      return { is_inline: true, title: "Untitled Database" };
    }
  }
}
