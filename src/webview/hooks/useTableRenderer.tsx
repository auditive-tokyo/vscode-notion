import React from "react";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";

type CellValue = string | { start: string | null; end: string | null };

/**
 * セルの値を文字列に変換
 */
const cellToString = (cell: CellValue): string => {
  if (typeof cell === "string") {
    return cell;
  }
  // DateValue オブジェクトの場合
  if (cell && typeof cell === "object" && "start" in cell) {
    if (cell.end && cell.start !== cell.end) {
      return `${cell.start} → ${cell.end}`;
    }
    return cell.start || "";
  }
  return "";
};

/**
 * テーブルをレンダリング（full page DB と inline DB で共通使用）
 */
export const useTableRenderer = (
  state: NotionWebviewState,
  openPageCommand: `${CommandId.OpenPage}`,
) => {
  const renderTable = (
    tableData: {
      columns: string[];
      rows: { id: string; cells: CellValue[] }[];
    },
    showDescription = true,
    description?: string | null,
  ) => {
    const displayDescription = description ?? state.description;
    return (
      <>
        {showDescription && displayDescription && (
          <p className="text-lg italic text-gray-300 mb-6">
            {displayDescription}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="notion-db-table w-full border-collapse">
            <thead>
              <tr>
                <th
                  className="px-4 py-2 text-left font-bold w-24"
                  style={{
                    border: "1px solid var(--vscode-textSeparator-foreground)",
                    backgroundColor: "var(--vscode-textCodeBlock-background)",
                  }}
                >
                  ACTION
                </th>
                {tableData.columns.map((col: string) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left font-bold"
                    style={{
                      border:
                        "1px solid var(--vscode-textSeparator-foreground)",
                      backgroundColor: "var(--vscode-textCodeBlock-background)",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row: { id: string; cells: CellValue[] }) => (
                <tr key={row.id}>
                  <td
                    className="px-4 py-2"
                    style={{
                      border:
                        "1px solid var(--vscode-textSeparator-foreground)",
                    }}
                  >
                    <a
                      href={`command:${openPageCommand}?${encodeURI(
                        JSON.stringify({
                          id: row.id,
                        } as OpenPageCommandArgs),
                      )}`}
                      className="px-3 py-1 rounded text-sm font-semibold transition inline-block no-underline"
                      style={{
                        backgroundColor: "var(--vscode-button-background)",
                        color: "var(--vscode-button-foreground)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--vscode-button-hoverBackground)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--vscode-button-background)";
                      }}
                    >
                      OPEN
                    </a>
                  </td>
                  {row.cells.map((cell: CellValue, cellIdx: number) => {
                    const columnKey =
                      tableData.columns[cellIdx] ?? String(cellIdx);
                    return (
                      <td
                        key={`${row.id}-${columnKey}`}
                        className="px-4 py-2"
                        style={{
                          border:
                            "1px solid var(--vscode-textSeparator-foreground)",
                        }}
                      >
                        {cellToString(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderBoard = (
    tableData: {
      columns: string[];
      rows: { id: string; cells: CellValue[] }[];
    },
    statusColorMap?: Record<string, string>,
    description?: string | null,
  ) => {
    // Status カラムを検出
    const statusColumnIndex = tableData.columns.findIndex(
      (col) => col.toLowerCase() === "status",
    );

    if (statusColumnIndex === -1) {
      return <div className="text-gray-400">Status column not found</div>;
    }

    // Status ごとに rows を分類
    const rowsByStatus: Record<string, typeof tableData.rows> = {};
    const statusOrder: string[] = [];

    tableData.rows.forEach((row) => {
      const statusValue = cellToString(row.cells[statusColumnIndex]);
      if (statusValue) {
        if (!rowsByStatus[statusValue]) {
          rowsByStatus[statusValue] = [];
          statusOrder.push(statusValue);
        }
        rowsByStatus[statusValue].push(row);
      }
    });

    // Status のカラーを取得
    const getStatusColor = (statusName: string): string => {
      if (!statusColorMap) return "#6b7280";
      const colorName = statusColorMap[statusName];
      const colorMap: Record<string, string> = {
        blue: "#3b82f6",
        red: "#ef4444",
        green: "#22c55e",
        gray: "#6b7280",
        yellow: "#eab308",
        purple: "#a855f7",
        pink: "#ec4899",
        brown: "#8b5cf6",
        orange: "#f97316",
        default: "#6b7280",
      };
      return colorMap[colorName] || colorMap.default;
    };

    // Title/Name カラムを検出
    const titleColumnIndex = tableData.columns.findIndex(
      (col) => col.toLowerCase() === "name" || col.toLowerCase() === "title",
    );
    const actualTitleIndex = titleColumnIndex >= 0 ? titleColumnIndex : 0;

    return (
      <>
        {description && (
          <p className="text-lg italic text-gray-300 mb-6">{description}</p>
        )}
        <div className="board-view">
          {statusOrder.map((status) => (
            <div key={status} className="board-column">
              <div
                className="board-column-header"
                style={{ borderTopColor: getStatusColor(status) }}
              >
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(status) }}
                >
                  {status}
                </span>
                <span className="status-count">
                  {rowsByStatus[status].length}
                </span>
              </div>
              <div className="board-cards">
                {rowsByStatus[status].map((row) => {
                  const titleValue = row.cells[actualTitleIndex];
                  const title = cellToString(titleValue);
                  return (
                    <div key={row.id} className="board-card">
                      <a
                        href={`command:${openPageCommand}?${encodeURI(
                          JSON.stringify({
                            id: row.id,
                          } as OpenPageCommandArgs),
                        )}`}
                        className="board-card-title"
                      >
                        {title || "Untitled"}
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return { renderTable, renderBoard };
};
