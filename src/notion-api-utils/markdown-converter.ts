/**
 * Notion ページとデータベースを Markdown に変換するユーティリティ
 * ページ全体やデータベーステーブルの高レベル変換を処理
 */

import { blocksToMarkdown } from "./block-to-markdown";
import {
  rowToMarkdownTableRow,
  extractPropertyValue,
  extractDatePropertyValue,
  extractStatusPropertyValue,
} from "./property-extractor";

/**
 * ページタイトルを抽出
 * データベースレコードの場合は id="title" のプロパティを使用
 * @param page - Notion API から取得したページオブジェクト
 * @returns ページのタイトル文字列
 */
export function extractPageTitle(page: any): string {
  if ("properties" in page && page.properties) {
    // プロパティの id が "title" であるものを探す（データベースレコード対応）
    for (const [, propValue] of Object.entries(page.properties)) {
      const prop = propValue as any;
      if (prop.id === "title") {
        const value = extractPropertyValue(prop);
        if (value) {
          return value;
        }
      }
    }
  }
  return "Untitled";
}

/**
 * ページのカバー画像URLを抽出
 * @param page - Notion API から取得したページオブジェクト
 * @returns カバー画像URL（ない場合は null）
 */
export function extractPageCover(page: any): string | null {
  if (!page.cover) {
    return null;
  }

  const cover = page.cover;

  // External cover (外部URL)
  if (cover.type === "external" && cover.external?.url) {
    return cover.external.url;
  }

  // File cover (Notion にアップロードされたファイル)
  if (cover.type === "file" && cover.file?.url) {
    return cover.file.url;
  }

  return null;
}

/**
 * ページのアイコンを抽出
 * @param page - Notion API から取得したページオブジェクト
 * @returns アイコンオブジェクト（ない場合は null）
 */
export function extractPageIcon(
  page: any,
): { type: string; emoji?: string; url?: string } | null {
  if (!page.icon) {
    return null;
  }

  const icon = page.icon;

  // Emoji icon
  if (icon.type === "emoji" && icon.emoji) {
    return { type: "emoji", emoji: icon.emoji };
  }

  // External icon（外部URL）
  if (icon.type === "external" && icon.external?.url) {
    return { type: "external", url: icon.external.url };
  }

  // File icon（Notion にアップロードされたファイル）
  if (icon.type === "file" && icon.file?.url) {
    return { type: "file", url: icon.file.url };
  }

  return null;
}

/**
 * データベースの説明を抽出
 * @param database - Notion API から取得したデータベースオブジェクト
 * @returns 説明テキスト（ない場合は null）
 */
export function extractDatabaseDescription(database: any): string | null {
  if (!database.description || !Array.isArray(database.description)) {
    return null;
  }

  const descriptionText = database.description
    .map((item: any) => item.plain_text || "")
    .join("");

  return descriptionText || null;
}

/**
 * ページオブジェクトを Markdown に変換
 * @param page - ページオブジェクト
 * @param blocks - ページのブロック配列
 * @returns Markdown 形式のページコンテンツ
 */
export async function convertPageToMarkdown(
  page: any,
  blocks: any[],
  getChildBlocks?: (blockId: string) => Promise<any[]>,
): Promise<string> {
  const title = extractPageTitle(page);
  let markdown = await blocksToMarkdown(blocks, getChildBlocks);

  // ブロックがない場合、properties から情報を抽出（データベースレコード対応）
  if (blocks.length === 0 && "properties" in page && page.properties) {
    const props = page.properties;
    const propLines: string[] = [];

    for (const [propName, propValue] of Object.entries(props)) {
      const prop = propValue as any;
      // id="title" のプロパティは既にタイトルとして使用しているので除外
      if (prop.id !== "title") {
        const value = extractPropertyValue(prop);
        if (value) {
          propLines.push(`**${propName}**: ${value}`);
        }
      }
    }

    if (propLines.length > 0) {
      markdown = propLines.join("\n\n");
    }
  }

  return `# ${title}\n\n${markdown}`;
}

/**
 * データベースオブジェクトを Markdown に変換
 * @param database - データベースオブジェクト
 * @param rows - データベースの行配列
 * @returns Markdown 形式のデータベースコンテンツ
 */
/**
 * データベース行をテーブルデータ構造に変換
 * @param rows - データベース行の配列
 * @returns テーブルデータ構造
 */
export function convertRowsToTableData(
  rows: any[],
  propertyNames: string[],
): {
  columns: string[];
  rows: {
    id: string;
    cells: (string | { start: string | null; end: string | null })[];
  }[];
} {
  return {
    columns: propertyNames,
    rows: rows.map((row) => ({
      id: row.id,
      cells: propertyNames.map((propName) => {
        const prop = row.properties[propName];
        // date 型は start/end オブジェクトを返す
        if (prop && prop.type === "date") {
          return extractDatePropertyValue(prop);
        }
        // その他は文字列を返す
        const value = extractPropertyValue(prop);
        return value;
      }),
    })),
  };
}

function getOrderedPropertyNames(
  properties: Record<string, any> | undefined,
): string[] {
  const names = Object.keys(properties || {});
  if (names.length === 0 || !properties) {
    return names;
  }

  const titleName = names.find((name) => {
    const prop = properties[name];
    return prop?.type === "title" || prop?.id === "title";
  });

  if (!titleName) {
    return names;
  }

  return [titleName, ...names.filter((name) => name !== titleName)];
}

/**
 * データベースオブジェクトを Markdown + テーブルデータに変換
 * @param database - データベースオブジェクト
 * @param rows - データベースの行配列
 * @returns { markdown, tableData, statusColorMap }
 */
function getDatabaseTitle(database: any): string {
  if (Array.isArray(database.title)) {
    return database.title.map((t: any) => t.plain_text).join("");
  }
  return "Untitled Database";
}

function detectDateProperty(rows: any[]): {
  datePropertyName?: string;
  viewType: "table" | "calendar" | "timeline";
} {
  const firstRow = rows[0];
  if (!firstRow) {
    return { viewType: "table" };
  }

  const properties = firstRow.properties || {};
  for (const [propName, propValue] of Object.entries(properties)) {
    if ((propValue as any).type !== "date") {
      continue;
    }

    const hasAnyDateValue = rows.some((row) => {
      const prop = row.properties[propName];
      return prop && prop.type === "date" && prop.date?.start;
    });

    if (!hasAnyDateValue) {
      continue;
    }

    // Determine viewType based on date range: timeline if end exists, calendar if start only
    const hasAnyDateRange = rows.some((row) => {
      const prop = row.properties[propName];
      return prop && prop.type === "date" && prop.date?.end !== null;
    });

    return {
      datePropertyName: propName,
      viewType: hasAnyDateRange ? "timeline" : "calendar",
    };
  }

  return { viewType: "table" };
}

function collectStatusColors(rows: any[]): Record<string, string> {
  const statusColorMap: Record<string, string> = {};
  const firstRow = rows[0];
  if (!firstRow) {
    return statusColorMap;
  }

  const firstRowProps = firstRow.properties || {};
  for (const propName in firstRowProps) {
    const prop = firstRowProps[propName];
    if (prop?.type !== "status") {
      continue;
    }

    // すべての行から status 値を集める
    for (const row of rows) {
      const rowProp = row.properties[propName];
      if (rowProp?.status) {
        const statusInfo = extractStatusPropertyValue(rowProp);
        if (statusInfo.name) {
          statusColorMap[statusInfo.name] = statusInfo.color;
        }
      }
    }
  }

  return statusColorMap;
}

export function convertDatabaseToMarkdownAndTable(
  database: any,
  rows: any[],
): {
  markdown: string;
  tableData: any;
  statusColorMap?: Record<string, string>;
  viewType?: "table" | "calendar" | "timeline";
  datePropertyName?: string;
} {
  const title = getDatabaseTitle(database);
  const firstRow = rows[0];
  const propertyNames = getOrderedPropertyNames(firstRow?.properties);

  const markdown = `# ${title}`;
  const tableData = convertRowsToTableData(rows, propertyNames);

  const { datePropertyName, viewType } = detectDateProperty(rows);
  const statusColorMap = collectStatusColors(rows);

  const result: {
    markdown: string;
    tableData: any;
    statusColorMap?: Record<string, string>;
    viewType?: "table" | "calendar" | "timeline";
    datePropertyName?: string;
  } = { markdown, tableData, viewType };

  if (Object.keys(statusColorMap).length > 0) {
    result.statusColorMap = statusColorMap;
  }

  if (datePropertyName) {
    result.datePropertyName = datePropertyName;
  }

  return result;
}

/**
 * データベース行をMarkdownテーブルに変換
 * @param rows - データベース行の配列
 * @returns Markdown テーブル形式の文字列
 */
export function convertRowsToMarkdownTable(rows: any[]): string {
  if (rows.length === 0) {
    return "*このデータベースには行がありません。*\n\n";
  }

  // プロパティ名を抽出（最初の行から）
  const firstRow = rows[0];
  const propertyNames = getOrderedPropertyNames(firstRow.properties);

  if (propertyNames.length === 0) {
    return "*プロパティが見つかりません。*\n\n";
  }

  // ヘッダー行（最初の列に空のヘッダー追加）
  const header = `|  | ${propertyNames.join(" | ")} |`;
  const separator = `| --- | ${propertyNames.map(() => "---").join(" | ")} |`;

  // データ行
  const dataRows = rows.map((row) => rowToMarkdownTableRow(row, propertyNames));

  // Markdownテーブルとして認識させるため、前後に空行を追加
  return "\n" + [header, separator, ...dataRows].join("\n") + "\n\n";
}

/**
 * inline DB プレースホルダーからデータを収集
 * is_inline: true のDBはテーブルデータを収集
 * is_inline: false のDBはリンクに置換
 * @param markdown - プレースホルダーを含むMarkdown
 * @param queryRows - データベース行取得関数
 * @param getDatabaseInfo - データベース情報取得関数
 * @returns { markdown: string, inlineDatabases: array }
 */
async function collectInlineDbData(
  markdown: string,
  queryRows: (databaseId: string) => Promise<any[]>,
  getDatabaseInfo?: (
    databaseId: string,
  ) => Promise<{ is_inline: boolean; title: string }>,
): Promise<{
  markdown: string;
  inlineDatabases: Array<{
    databaseId: string;
    title: string;
    viewType: "table" | "calendar" | "timeline";
    datePropertyName?: string;
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
    };
  }>;
}> {
  // プレースホルダーのパターン: __INLINE_DB_PLACEHOLDER__id__title__
  const placeholderPattern = /__INLINE_DB_PLACEHOLDER__([^_]+)__(.+?)__/g;
  const matches = [...markdown.matchAll(placeholderPattern)];

  if (matches.length === 0) {
    return { markdown, inlineDatabases: [] };
  }

  const inlineDatabases: Array<{
    databaseId: string;
    title: string;
    viewType: "table" | "calendar" | "timeline";
    datePropertyName?: string;
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
    };
  }> = [];

  let resultMarkdown = markdown;

  for (const match of matches) {
    const [fullMatch, databaseId, title] = match;

    if (!databaseId || !title) {
      continue;
    }

    try {
      // is_inline を判定
      let isInline = true; // デフォルトはinline扱い
      let dbTitle = title;

      if (getDatabaseInfo) {
        const dbInfo = await getDatabaseInfo(databaseId);
        isInline = dbInfo.is_inline;
        dbTitle = dbInfo.title || title;
      }

      if (!isInline) {
        // Full Page DB: リンクに置換
        resultMarkdown = resultMarkdown.replace(
          fullMatch,
          `📋 [${dbTitle}](/${databaseId})`,
        );
        continue;
      }

      // Inline DB: テーブルデータを収集
      const rows = await queryRows(databaseId);

      if (rows.length > 0) {
        // プロパティ名を抽出
        const firstRow = rows[0];
        const properties = firstRow.properties || {};
        const propertyNames = getOrderedPropertyNames(properties);

        // 日付プロパティを検出
        let datePropertyName: string | undefined;

        for (const [propName, propValue] of Object.entries(properties)) {
          if ((propValue as any).type === "date") {
            const hasAnyDateValue = rows.some((row) => {
              const prop = row.properties[propName];
              return prop && prop.type === "date" && prop.date?.start;
            });

            if (!hasAnyDateValue) {
              continue;
            }

            datePropertyName = propName;
            break;
          }
        }

        // viewType: timeline if end exists, calendar if start only, table if no date
        let viewType: "table" | "calendar" | "timeline" = "table";
        if (datePropertyName) {
          // Check if any row has date range
          const hasAnyDateRange = rows.some((row) => {
            const prop = row.properties[datePropertyName];
            return prop && prop.type === "date" && prop.date?.end !== null;
          });
          viewType = hasAnyDateRange ? "timeline" : "calendar";
        }

        const tableData = convertRowsToTableData(rows, propertyNames);

        // Status カラーマップを生成
        let statusColorMap: Record<string, string> | undefined;
        for (const propName in properties) {
          const prop = properties[propName];
          if (prop && prop.type === "status") {
            statusColorMap = {};
            // すべての行から status 値を集める
            for (const row of rows) {
              const rowProp = row.properties[propName];
              if (rowProp && rowProp.status) {
                const statusInfo = extractStatusPropertyValue(rowProp);
                if (statusInfo.name) {
                  statusColorMap[statusInfo.name] = statusInfo.color;
                }
              }
            }
            break;
          }
        }

        inlineDatabases.push({
          databaseId,
          title: dbTitle,
          viewType,
          ...(datePropertyName ? { datePropertyName } : {}),
          ...(statusColorMap ? { statusColorMap } : {}),
          tableData,
        });
      }
    } catch (error) {
      console.error("[markdown-converter] Failed to process DB:", error);
      // エラー時はリンクにフォールバック
      resultMarkdown = resultMarkdown.replace(
        fullMatch,
        `📋 [${title}](/${databaseId})`,
      );
    }
  }

  return { markdown: resultMarkdown, inlineDatabases };
}

/**
 * NotionApiClient.getPageOrDatabaseWithOfficialApi() から呼ばれます。
 * ページ取得時に、ブロック取得処理をコールバック関数として受け取り、
 * 変換ロジックは純粋な関数として分離しています。
 *
 * @param page - Notion API から取得したページオブジェクト
 * @param getBlocks - ページのブロック取得関数（NotionApiClient.getPageBlocksRecursive）
 * @param queryRows - データベース行取得関数（オプション、inline DB用）
 * @param getDatabaseInfo - データベース情報取得関数（オプション、is_inline判定用）
 * @returns { markdown, coverUrl, inlineDatabases } オブジェクト
 * @see NotionApiClient.getPageOrDatabaseWithOfficialApi
 */
export async function convertPageToMarkdownHelper(
  page: any,
  getBlocks: (pageId: string) => Promise<any[]>,
  queryRows?: (databaseId: string) => Promise<any[]>,
  getDatabaseInfo?: (
    databaseId: string,
  ) => Promise<{ is_inline: boolean; title: string }>,
): Promise<{
  markdown: string;
  coverUrl: string | null;
  icon: { type: string; emoji?: string; url?: string } | null;
  inlineDatabases?: Array<{
    databaseId: string;
    title: string;
    viewType: "table" | "calendar" | "timeline";
    datePropertyName?: string;
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
    };
  }>;
}> {
  const blocks = await getBlocks(page.id);
  let markdown = await convertPageToMarkdown(page, blocks, getBlocks);

  let inlineDatabases: Array<{
    databaseId: string;
    title: string;
    viewType: "table" | "calendar" | "timeline";
    datePropertyName?: string;
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
    };
  }> = [];

  // inline DB データを収集（is_inline判定含む）
  if (queryRows) {
    const result = await collectInlineDbData(
      markdown,
      queryRows,
      getDatabaseInfo,
    );
    markdown = result.markdown;
    inlineDatabases = result.inlineDatabases;
  }

  const coverUrl = extractPageCover(page);
  const icon = extractPageIcon(page);
  return { markdown, coverUrl, icon, inlineDatabases };
}

/**
 * NotionApiClient.getPageOrDatabaseWithOfficialApi() から呼ばれます。
 * データベース取得時に、行取得処理をコールバック関数として受け取り、
 * 変換ロジックは純粋な関数として分離しています。
 *
 * @param database - Notion API から取得したデータベースオブジェクト
 * @param queryRows - データベースの行取得関数（NotionApiClient.queryDatabaseRows）
 * @returns { markdown, tableData, coverUrl } オブジェクト
 * @see NotionApiClient.getPageOrDatabaseWithOfficialApi
 */
export async function convertDatabaseToMarkdownHelper(
  database: any,
  queryRows: (databaseId: string) => Promise<any[]>,
): Promise<{
  markdown: string;
  tableData: any;
  coverUrl: string | null;
  icon: { type: string; emoji?: string; url?: string } | null;
  description: string | null;
  viewType?: "table" | "calendar" | "timeline";
  datePropertyName?: string;
  statusColorMap?: Record<string, string>;
}> {
  const rows = await queryRows(database.id);

  const result = convertDatabaseToMarkdownAndTable(database, rows);
  const coverUrl = extractPageCover(database);
  const icon = extractPageIcon(database);
  const description = extractDatabaseDescription(database);
  return { ...result, coverUrl, icon, description };
}
