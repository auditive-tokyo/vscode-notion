/**
 * Notion ページとデータベースを Markdown に変換するユーティリティ
 * ページ全体やデータベーステーブルの高レベル変換を処理
 */

import { blocksToMarkdown } from "./block-to-markdown";
import {
  rowToMarkdownTableRow,
  extractPropertyValue,
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
): { columns: string[]; rows: { id: string; cells: string[] }[] } {
  return {
    columns: propertyNames,
    rows: rows.map((row) => ({
      id: row.id,
      cells: propertyNames.map((propName) => {
        const prop = row.properties[propName];
        const value = extractPropertyValue(prop);
        return value;
      }),
    })),
  };
}

/**
 * データベースオブジェクトを Markdown + テーブルデータに変換
 * @param database - データベースオブジェクト
 * @param rows - データベースの行配列
 * @returns { markdown, tableData }
 */
export function convertDatabaseToMarkdownAndTable(
  database: any,
  rows: any[],
): { markdown: string; tableData: any } {
  // データベースタイトルを取得
  let title = "Untitled Database";
  if (Array.isArray(database.title)) {
    title = database.title.map((t: any) => t.plain_text).join("");
  }

  // プロパティ名を抽出
  const firstRow = rows[0];
  const propertyNames = Object.keys(firstRow?.properties || {});

  const markdown = `# ${title}`;
  const tableData = convertRowsToTableData(rows, propertyNames);

  console.log("[markdown-converter] tableData created:", tableData);
  console.log("[markdown-converter] returning tableData:", {
    markdown,
    tableData,
  });

  return { markdown, tableData };
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
  const propertyNames = Object.keys(firstRow.properties || {});

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
 * NotionApiClient.getPageOrDatabaseWithOfficialApi() から呼ばれます。
 * ページ取得時に、ブロック取得処理をコールバック関数として受け取り、
 * 変換ロジックは純粋な関数として分離しています。
 *
 * @param page - Notion API から取得したページオブジェクト
 * @param getBlocks - ページのブロック取得関数（NotionApiClient.getPageBlocksRecursive）
 * @returns { markdown, coverUrl } オブジェクト
 * @see NotionApiClient.getPageOrDatabaseWithOfficialApi
 */
export async function convertPageToMarkdownHelper(
  page: any,
  getBlocks: (pageId: string) => Promise<any[]>,
): Promise<{
  markdown: string;
  coverUrl: string | null;
  icon: { type: string; emoji?: string; url?: string } | null;
}> {
  const blocks = await getBlocks(page.id);
  const markdown = await convertPageToMarkdown(page, blocks, getBlocks);
  const coverUrl = extractPageCover(page);
  const icon = extractPageIcon(page);
  return { markdown, coverUrl, icon };
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
}> {
  console.log("[notion-api-utils] Database ID:", database.id);
  console.log(
    "[notion-api-utils] Database has",
    database.data_sources?.length || 0,
    "data sources",
  );

  const rows = await queryRows(database.id);
  console.log("[notion-api-utils] Retrieved", rows.length, "rows");

  const result = convertDatabaseToMarkdownAndTable(database, rows);
  const coverUrl = extractPageCover(database);
  const icon = extractPageIcon(database);
  const description = extractDatabaseDescription(database);
  return { ...result, coverUrl, icon, description };
}
