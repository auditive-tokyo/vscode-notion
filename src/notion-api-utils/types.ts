/**
 * Notion API レスポンス型定義
 */

export interface DateValue {
  start: string | null;
  end: string | null;
}

export interface TableCell {
  type: string;
  value: string | DateValue;
}

export interface InlineDatabase {
  databaseId: string;
  title: string;
  viewType: "table" | "calendar" | "timeline";
  datePropertyName?: string;
  description?: string | null;
  tableData: {
    columns: string[];
    rows: {
      id: string;
      cells: (string | DateValue)[];
    }[];
  };
}

export interface PageData {
  data: string;
  type: "page" | "database";
  tableData?: any;
  coverUrl?: string | null;
  icon?: { type: string; emoji?: string; url?: string } | null;
  description?: string | null;
  inlineDatabases?: InlineDatabase[];
}
