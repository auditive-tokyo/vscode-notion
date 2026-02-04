import React from "react";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";
import type { DateValue } from "@/notion-api-utils/types";
export const useTimelineRenderer = (
  state: NotionWebviewState,
  openPageCommand: `${CommandId.OpenPage}`,
) => {
  const renderTimeline = (
    db: NonNullable<typeof state.inlineDatabases>[number],
  ) => {
    const dateColumnIndex = db.tableData.columns.indexOf(db.datePropertyName!);
    const titleColumnIndex = 0; // 最初の列をタイトルとする

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
        <div className="timeline-scale bg-gray-100 rounded p-2 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>{minDate.toLocaleDateString()}</span>
            <span>{maxDate.toLocaleDateString()}</span>
          </div>
          <div className="text-gray-400 mt-1">{dayCount} days</div>
        </div>

        {/* タイムライン アイテム */}
        {rowsWithDates.map((row, idx) => {
          const dateValue = row.cells[dateColumnIndex] as DateValue;
          const start = new Date(dateValue.start!);
          const end = dateValue.end ? new Date(dateValue.end) : start;
          const titleValue = row.cells[titleColumnIndex];
          const title =
            typeof titleValue === "string"
              ? titleValue
              : titleValue?.start || "Untitled";

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
                  className="text-blue-600 hover:underline text-sm font-medium"
                  title={String(title)}
                >
                  {title}
                </a>
              </div>

              {/* Gantt バー */}
              <div className="grow h-8 bg-gray-200 rounded relative overflow-hidden">
                <div
                  className="absolute h-full bg-blue-500 rounded hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{
                    left: `${startPos}%`,
                    width: `${width}%`,
                    minWidth: "2px",
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

              {/* 日付テキスト */}
              <div className="w-24 shrink-0 text-right text-xs text-gray-600">
                {dateValue.end && dateValue.start !== dateValue.end
                  ? `${Math.ceil(
                      (new Date(dateValue.end).getTime() -
                        new Date(dateValue.start).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )}d`
                  : "1d"}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return { renderTimeline };
};
