/**
 * Notion ページとデータベースを Markdown に変換するユーティリティ
 * ページ全体やデータベーステーブルの高レベル変換を処理
 */

import { blocksToMarkdown } from "./block-to-markdown";
import { rowToMarkdownTableRow } from "./property-extractor";

/**
 * ページタイトルを抽出
 * @param page - Notion API から取得したページオブジェクト
 * @returns ページのタイトル文字列
 */
export function extractPageTitle(page: any): string {
  if ("properties" in page && page.properties && "title" in page.properties) {
    const titleProp = page.properties["title"];
    if ("title" in titleProp && Array.isArray(titleProp.title)) {
      return titleProp.title.map((t: any) => t.plain_text).join("");
    }
  }
  return "Untitled";
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
  const markdown = await blocksToMarkdown(blocks, getChildBlocks);

  return `# ${title}\n\n${markdown}`;
}

/**
 * データベースオブジェクトを Markdown に変換
 * @param database - データベースオブジェクト
 * @param rows - データベースの行配列
 * @returns Markdown 形式のデータベースコンテンツ
 */
export function convertDatabaseToMarkdown(database: any, rows: any[]): string {
  // データベースタイトルを取得
  let title = "Untitled Database";
  if (Array.isArray(database.title)) {
    title = database.title.map((t: any) => t.plain_text).join("");
  }

  // 行を Markdown テーブルに変換
  const tableMarkdown = convertRowsToMarkdownTable(rows);

  return `# ${title}\n\n${tableMarkdown}`;
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

  // ヘッダー行
  const header = `| ${propertyNames.join(" | ")} |`;
  const separator = `| ${propertyNames.map(() => "---").join(" | ")} |`;

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
 * @returns Markdown 形式のページコンテンツ
 * @see NotionApiClient.getPageOrDatabaseWithOfficialApi
 */
export async function convertPageToMarkdownHelper(
  page: any,
  getBlocks: (pageId: string) => Promise<any[]>,
): Promise<string> {
  const blocks = await getBlocks(page.id);
  return convertPageToMarkdown(page, blocks, getBlocks);
}

/**
 * NotionApiClient.getPageOrDatabaseWithOfficialApi() から呼ばれます。
 * データベース取得時に、行取得処理をコールバック関数として受け取り、
 * 変換ロジックは純粋な関数として分離しています。
 *
 * @param database - Notion API から取得したデータベースオブジェクト
 * @param queryRows - データベースの行取得関数（NotionApiClient.queryDatabaseRows）
 * @returns Markdown 形式のデータベースコンテンツ
 * @see NotionApiClient.getPageOrDatabaseWithOfficialApi
 */
export async function convertDatabaseToMarkdownHelper(
  database: any,
  queryRows: (databaseId: string) => Promise<any[]>,
): Promise<string> {
  console.log("[notion-api-utils] Database ID:", database.id);
  console.log(
    "[notion-api-utils] Database has",
    database.data_sources?.length || 0,
    "data sources",
  );

  const rows = await queryRows(database.id);
  console.log("[notion-api-utils] Retrieved", rows.length, "rows");

  return convertDatabaseToMarkdown(database, rows);
}
