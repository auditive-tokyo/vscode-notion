import React from "react";
import type { NotionWebviewState } from "../../ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "../../ui/open-page-command";
import type { CommandId } from "../../constants";

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
      rows: { id: string; cells: string[] }[];
    },
    showDescription = true,
  ) => {
    return (
      <>
        {showDescription && state.description && (
          <p className="text-lg italic text-gray-300 mb-6">
            {state.description}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-600 px-4 py-2 bg-gray-800 text-left font-bold w-24">
                  ACTION
                </th>
                {tableData.columns.map((col: string) => (
                  <th
                    key={col}
                    className="border border-gray-600 px-4 py-2 bg-gray-800 text-left font-bold"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map(
                (row: { id: string; cells: string[] }, idx: number) => (
                  <tr key={idx}>
                    <td className="border border-gray-600 px-4 py-2">
                      <a
                        href={`command:${openPageCommand}?${encodeURI(
                          JSON.stringify({
                            id: row.id,
                          } as OpenPageCommandArgs),
                        )}`}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm font-semibold transition inline-block no-underline"
                      >
                        OPEN
                      </a>
                    </td>
                    {row.cells.map((cell: string, cellIdx: number) => (
                      <td
                        key={cellIdx}
                        className="border border-gray-600 px-4 py-2"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return renderTable;
};
