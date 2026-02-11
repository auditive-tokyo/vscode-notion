import React from "react";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";
import { cellToString, type CellValue } from "./cellUtils";

/**
 * Table view renderer (row-based table layout)
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

  return renderTable;
};
