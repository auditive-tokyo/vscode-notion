/**
 * Database プロパティから値を抽出するユーティリティ
 * 各プロパティ型に対応した値抽出ロジックを提供
 */

/**
 * Date プロパティから start/end を抽出
 * @param prop - Notion API から取得したdate型プロパティ
 * @returns { start, end } オブジェクト
 */
export function extractDatePropertyValue(prop: any): {
  start: string | null;
  end: string | null;
} {
  if (prop?.type !== "date") {
    return { start: null, end: null };
  }
  return {
    start: prop.date?.start || null,
    end: prop.date?.end || null,
  };
}

/**
 * Status プロパティから名前と色を抽出
 * @param prop - Notion API から取得したstatus型プロパティ
 * @returns { name, color } オブジェクト
 */
export function extractStatusPropertyValue(prop: any): {
  name: string;
  color: string;
} {
  if (prop?.type !== "status") {
    return { name: "", color: "default" };
  }
  return {
    name: prop.status?.name || "",
    color: prop.status?.color || "default",
  };
}

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
      if (prop.date?.end) {
        return `${prop.date.start} → ${prop.date.end}`;
      }
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
    case "created_time":
      return prop.created_time || "";
    case "last_edited_time":
      return prop.last_edited_time || "";
    default:
      return "";
  }
}

/**
 * データベース行をMarkdownテーブル行に変換
 * 最初のセルに OPEN ボタンを追加
 * @param row - データベースの行オブジェクト
 * @param propertyNames - テーブルのカラム名
 * @returns Markdown テーブル行の文字列
 */
export function rowToMarkdownTableRow(
  row: any,
  propertyNames: string[],
): string {
  const cells = propertyNames.map((propName) => {
    const prop = row.properties[propName];
    const value = extractPropertyValue(prop);
    const escapedValue = value.replaceAll("|", "\\|").replaceAll("\n", " ");
    return escapedValue;
  });

  // 最初のセルの前に OPEN ボタンを追加
  const openButton = row.id ? `[OPEN](/${row.id})` : "";

  return `| ${openButton} | ${cells.join(" | ")} |`;
}
