import React from "react";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";
import type { DateValue } from "@/notion-api-utils/types";

/**
 * Notion status 色コードから CSS カラー値を取得
 */
function getBarColor(
  statusName: string | null,
  statusColorMap?: Record<string, string>,
): string {
  if (!statusName || !statusColorMap) {
    return "#3b82f6"; // デフォルト: blue-500
  }

  const colorName = statusColorMap[statusName];
  if (!colorName) {
    return "#3b82f6";
  }

  // Notion のカラーマッピング
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
}

export const useTimelineRenderer = (
  state: NotionWebviewState,
  openPageCommand: `${CommandId.OpenPage}`,
) => {
  const renderTimeline = (
    db: NonNullable<typeof state.inlineDatabases>[number],
  ) => {
    const dateColumnIndex = db.tableData.columns.indexOf(db.datePropertyName!);
    // Title/Name カラムを探す（見つからなければ最初の列）
    const titleColumnIndex = db.tableData.columns.findIndex(
      (col) => col.toLowerCase() === "name" || col.toLowerCase() === "title",
    );
    const actualTitleIndex = titleColumnIndex >= 0 ? titleColumnIndex : 0;
    const statusColumnIndex = db.tableData.columns.findIndex(
      (col) => col.toLowerCase() === "status",
    );

    // 日付範囲を取得
    const allDates: { start: Date; end: Date }[] = [];
    const rowsWithDates = db.tableData.rows.filter((row) => {
      const dateValue = row.cells[dateColumnIndex] as DateValue | string;
      if (typeof dateValue === "object" && dateValue.start) {
        const start = new Date(dateValue.start);
        const end = dateValue.end ? new Date(dateValue.end) : start;
        allDates.push({ start, end });
        return true;
      }
      return false;
    });

    if (rowsWithDates.length === 0) {
      return <div className="text-gray-400">No timeline data available</div>;
    }

    // 最小日付と最大日付を算出
    const allStartDates = allDates.map((d) => d.start.getTime());
    const allEndDates = allDates.map((d) => d.end.getTime());
    const minDate = new Date(Math.min(...allStartDates));
    const maxDate = new Date(Math.max(...allEndDates));

    // 日付範囲（ミリ秒）
    const totalRange = maxDate.getTime() - minDate.getTime();
    const dayCount = Math.ceil(totalRange / (1000 * 60 * 60 * 24)) + 1;

    /**
     * 日付をバーの位置に変換
     */
    const dateToPosition = (date: Date): number => {
      const diff = date.getTime() - minDate.getTime();
      return (diff / totalRange) * 100;
    };

    /**
     * 日付範囲をバーの幅に変換
     */
    const dateRangeToWidth = (start: Date, end: Date): number => {
      const startPos = dateToPosition(start);
      const endPos = dateToPosition(end);
      return endPos - startPos || 0.5; // 最小幅 0.5%
    };

    return (
      <div className="timeline-container space-y-3">
        {/* タイムスケール */}
        <div className="timeline-scale bg-(--vscode-editor-inactiveSelectionBackground) rounded p-2 text-xs text-(--vscode-descriptionForeground)">
          <div className="flex justify-between">
            <span>{minDate.toLocaleDateString()}</span>
            <span>{maxDate.toLocaleDateString()}</span>
          </div>
          <div className="opacity-60 mt-1">{dayCount} days</div>
        </div>

        {/* タイムライン アイテム */}
        {rowsWithDates.map((row, idx) => {
          const dateValue = row.cells[dateColumnIndex] as DateValue;
          const start = new Date(dateValue.start!);
          const end = dateValue.end ? new Date(dateValue.end) : start;
          const titleValue = row.cells[actualTitleIndex];
          const title =
            typeof titleValue === "string"
              ? titleValue
              : titleValue?.start || "Untitled";
          const statusValue =
            statusColumnIndex >= 0
              ? (row.cells[statusColumnIndex] as string)
              : null;

          const startPos = dateToPosition(start);
          const width = dateRangeToWidth(start, end);

          return (
            <div key={idx} className="timeline-item flex items-center gap-3">
              {/* タイトル */}
              <div className="w-32 shrink-0 truncate">
                <a
                  href={`command:${openPageCommand}?${encodeURI(
                    JSON.stringify({ id: row.id } as OpenPageCommandArgs),
                  )}`}
                  className="text-(--vscode-textLink-foreground) hover:underline text-sm font-medium"
                  title={String(title)}
                >
                  {title}
                </a>
              </div>

              {/* Gantt バー */}
              <div className="grow h-8 bg-(--vscode-editor-inactiveSelectionBackground) rounded relative overflow-hidden">
                <div
                  className="absolute h-full rounded cursor-pointer"
                  style={{
                    left: `${startPos}%`,
                    width: `${width}%`,
                    minWidth: "2px",
                    backgroundColor: getBarColor(
                      statusValue,
                      db.statusColorMap,
                    ),
                  }}
                  title={`${dateValue.start} to ${
                    dateValue.end || dateValue.start
                  }`}
                >
                  <div className="h-full flex items-center px-1 text-white text-xs font-medium overflow-hidden">
                    {dateValue.end
                      ? `${dateValue.start} → ${dateValue.end}`
                      : dateValue.start}
                  </div>
                </div>
              </div>

              {/* Status バッジ */}
              <div className="w-24 shrink-0 text-right">
                {statusValue && (
                  <span className="inline-block px-2 py-0.5 text-xs rounded bg-(--vscode-badge-background) text-(--vscode-badge-foreground)">
                    {statusValue}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return { renderTimeline };
};
