import { Client } from "@notionhq/client";
import { Injectable } from "vedk";
import * as vscode from "vscode";

/**
 * Notion APIクライアント
 * 公式API (@notionhq/client) を使用してページとデータベースを取得
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
      return this.convertPageToMarkdown(pageResult.value);
    } else if (databaseResult.status === "fulfilled") {
      console.log("[notion-api-client] Retrieved as database");
      return this.convertDatabaseToMarkdown(databaseResult.value);
    } else {
      throw new Error("Failed to retrieve page or database");
    }
  }

  /**
   * ページオブジェクトをMarkdownに変換
   */
  private async convertPageToMarkdown(page: any): Promise<string> {
    // ページタイトルを取得
    let title = "Untitled";
    if ("properties" in page && page.properties && "title" in page.properties) {
      const titleProp = page.properties["title"];
      if ("title" in titleProp && Array.isArray(titleProp.title)) {
        title = titleProp.title.map((t: any) => t.plain_text).join("");
      }
    }

    // ブロックを取得してMarkdownに変換
    const blocks = await this.getPageBlocksRecursive(page.id);
    const markdown = await this.blocksToMarkdown(blocks);

    return `# ${title}\n\n${markdown}`;
  }

  /**
   * データベースオブジェクトをMarkdownに変換
   */
  private async convertDatabaseToMarkdown(database: any): Promise<string> {
    // データベースタイトルを取得
    let title = "Untitled Database";
    if (Array.isArray(database.title)) {
      title = database.title.map((t: any) => t.plain_text).join("");
    }

    console.log("[notion-api-client] Database ID:", database.id);
    console.log(
      "[notion-api-client] Database has",
      database.data_sources?.length || 0,
      "data sources",
    );

    // データベースの行を取得
    const rows = await this.queryDatabaseRows(database.id);
    console.log("[notion-api-client] Retrieved", rows.length, "rows");

    // 行をMarkdownテーブルに変換
    const tableMarkdown = this.convertRowsToMarkdownTable(rows);

    return `# ${title}\n\n${tableMarkdown}`;
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
   * データベース行をMarkdownテーブルに変換
   */
  private convertRowsToMarkdownTable(rows: any[]): string {
    if (rows.length === 0) {
      return "*このデータベースには行がありません。*\n\n";
    }

    // プロパティ名を抽出（最初の行から）
    const firstRow = rows[0];
    const propertyNames = Object.keys(firstRow.properties || {});

    if (propertyNames.length === 0) {
      return "*プロパティが見つかりません。*\n\n";
    }

    // ヘッダー行
    const header = `| ${propertyNames.join(" | ")} |`;
    const separator = `| ${propertyNames.map(() => "---").join(" | ")} |`;

    // データ行
    const dataRows = rows.map((row) => {
      const cells = propertyNames.map((propName) => {
        const prop = row.properties[propName];
        const value = this.extractPropertyValue(prop);
        // パイプ文字と改行をエスケープ
        return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
      });
      return `| ${cells.join(" | ")} |`;
    });

    // Markdownテーブルとして認識させるため、前後に空行を追加
    return "\n" + [header, separator, ...dataRows].join("\n") + "\n\n";
  }

  /**
   * プロパティから値を抽出（簡易版）
   */
  private extractPropertyValue(prop: any): string {
    if (!prop) return "";

    switch (prop.type) {
      case "title":
        return prop.title?.map((t: any) => t.plain_text).join("") || "";
      case "rich_text":
        return prop.rich_text?.map((t: any) => t.plain_text).join("") || "";
      case "number":
        return prop.number?.toString() || "";
      case "select":
        return prop.select?.name || "";
      case "multi_select":
        return prop.multi_select?.map((s: any) => s.name).join(", ") || "";
      case "date":
        return prop.date?.start || "";
      case "checkbox":
        return prop.checkbox ? "✓" : "";
      case "url":
        return prop.url || "";
      case "email":
        return prop.email || "";
      case "phone_number":
        return prop.phone_number || "";
      case "status":
        return prop.status?.name || "";
      default:
        return "";
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

  /**
   * ブロック一覧をMarkdownに変換
   */
  private async blocksToMarkdown(blocks: any[]): Promise<string> {
    let markdown = "";

    for (const block of blocks) {
      markdown += this.blockToMarkdown(block) + "\n";

      // 子ブロックがあれば再帰的に処理
      if (block.has_children) {
        try {
          const childBlocks = await this.getPageBlocksRecursive(block.id);
          const childMarkdown = await this.blocksToMarkdown(childBlocks);
          markdown += childMarkdown;
        } catch (error) {
          console.warn(
            "[notion-api-client] Failed to get child blocks:",
            error,
          );
        }
      }
    }

    return markdown;
  }

  /**
   * 単一ブロックをMarkdownに変換
   */
  private blockToMarkdown(block: any): string {
    const type = block.type;

    try {
      switch (type) {
        case "paragraph":
          return (
            block.paragraph?.rich_text
              ?.map((t: any) => t.plain_text)
              .join("") || ""
          );

        case "heading_1":
          return (
            "# " +
            (block.heading_1?.rich_text
              ?.map((t: any) => t.plain_text)
              .join("") || "")
          );

        case "heading_2":
          return (
            "## " +
            (block.heading_2?.rich_text
              ?.map((t: any) => t.plain_text)
              .join("") || "")
          );

        case "heading_3":
          return (
            "### " +
            (block.heading_3?.rich_text
              ?.map((t: any) => t.plain_text)
              .join("") || "")
          );

        case "bulleted_list_item":
          return (
            "- " +
            (block.bulleted_list_item?.rich_text
              ?.map((t: any) => t.plain_text)
              .join("") || "")
          );

        case "numbered_list_item":
          return (
            "1. " +
            (block.numbered_list_item?.rich_text
              ?.map((t: any) => t.plain_text)
              .join("") || "")
          );

        case "to_do":
          const checked = block.to_do?.checked ? "[x]" : "[ ]";
          const text =
            block.to_do?.rich_text?.map((t: any) => t.plain_text).join("") ||
            "";
          return checked + " " + text;

        case "toggle":
          return (
            "> " +
            (block.toggle?.rich_text?.map((t: any) => t.plain_text).join("") ||
              "")
          );

        case "quote":
          return (
            "> " +
            (block.quote?.rich_text?.map((t: any) => t.plain_text).join("") ||
              "")
          );

        case "code":
          const language = block.code?.language || "text";
          const code =
            block.code?.rich_text?.map((t: any) => t.plain_text).join("") || "";
          return `\`\`\`${language}\n${code}\n\`\`\``;

        case "divider":
          return "---";

        case "image":
          const imageUrl =
            block.image?.external?.url || block.image?.file?.url || "";
          const imageCaption =
            block.image?.caption?.map((t: any) => t.plain_text).join("") || "";
          return `![${imageCaption}](${imageUrl})`;

        case "bookmark":
          return `[Link](${block.bookmark?.url})`;

        case "child_page":
          return `📄 ${block.child_page?.title || "Untitled Page"}`;

        case "child_database":
          return `📊 ${block.child_database?.title || "Untitled Database"}`;

        default:
          console.warn(`[notion-api-client] Unsupported block type: ${type}`);
          return "";
      }
    } catch (error) {
      console.warn(
        `[notion-api-client] Error converting block of type ${type}:`,
        error,
      );
      return "";
    }
  }
}
