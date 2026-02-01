/**
 * Database プロパティから値を抽出するユーティリティ
 * 各プロパティ型に対応した値抽出ロジックを提供
 */

/**
 * 単一のプロパティから値を抽出
 * @param prop - Notion API から取得したプロパティオブジェクト
 * @returns 値の文字列表現
 */
export function extractPropertyValue(prop: any): string {
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
 * データベース行をMarkdownテーブル行に変換
 * @param row - データベースの行オブジェクト
 * @param propertyNames - テーブルのカラム名
 * @returns Markdown テーブル行の文字列
 */
export function rowToMarkdownTableRow(row: any, propertyNames: string[]): string {
  const cells = propertyNames.map((propName) => {
    const prop = row.properties[propName];
    const value = extractPropertyValue(prop);
    // パイプ文字と改行をエスケープ
    return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
  });
  return `| ${cells.join(" | ")} |`;
}
