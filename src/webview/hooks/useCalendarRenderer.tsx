import React from "react";
import Calendar from "react-calendar";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * カレンダー表示（react-calendar使用）
 */
export const useCalendarRenderer = (
  state: NotionWebviewState,
  openPageCommand: `${CommandId.OpenPage}`,
) => {
  const renderCalendar = (
    db: NonNullable<typeof state.inlineDatabases>[number],
  ) => {
    const dateColumnIndex = db.tableData.columns.indexOf(db.datePropertyName!);
    const titleColumnIndex = 0; // 最初の列をタイトルとする

    // Check if there are any rows with dates
    const rowsWithDates = db.tableData.rows.filter((row) => {
      const dateValue = row.cells[dateColumnIndex];
      const dateStr =
        typeof dateValue === "string" ? dateValue : dateValue?.start;
      return dateStr !== null && dateStr !== undefined;
    });

    if (rowsWithDates.length === 0) {
      return <div className="text-gray-400">Date property is empty</div>;
    }

    /**
     * 日付範囲をマップに追加
     */
    function addDateRangeToMap(
      map: Map<string, (typeof db.tableData.rows)[number][]>,
      dateRange: { start: string; end?: string },
      row: (typeof db.tableData.rows)[number],
    ): void {
      const startDate = new Date(dateRange.start);
      const endDate = dateRange.end ? new Date(dateRange.end) : startDate;

      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = formatDateString(d);
        if (!map.has(dateStr)) {
          map.set(dateStr, []);
        }
        map.get(dateStr)!.push(row);
      }
    }

    /**
     * 単一日付をマップに追加
     */
    function addSingleDateToMap(
      map: Map<string, (typeof db.tableData.rows)[number][]>,
      dateStr: string | undefined,
      row: (typeof db.tableData.rows)[number],
    ): void {
      if (dateStr) {
        if (!map.has(dateStr)) {
          map.set(dateStr, []);
        }
        map.get(dateStr)!.push(row);
      }
    }

    /**
     * イベントを日付ごとにマッピング
     */
    function buildEventsByDateMap(): Map<
      string,
      (typeof db.tableData.rows)[number][]
    > {
      const eventsByDate = new Map<
        string,
        (typeof db.tableData.rows)[number][]
      >();

      for (const row of db.tableData.rows) {
        const dateValue = row.cells[dateColumnIndex];
        // Date型オブジェクト: start～end の全日付を追加
        if (typeof dateValue === "object" && dateValue?.start) {
          addDateRangeToMap(eventsByDate, dateValue, row);
        } else if (typeof dateValue === "string" || dateValue?.start) {
          // 文字列形式の日付: 単一日付を追加
          const singleDateStr =
            typeof dateValue === "string"
              ? dateValue
              : (dateValue as { start?: string }).start;
          addSingleDateToMap(eventsByDate, singleDateStr, row);
        }
      }

      return eventsByDate;
    }

    // 日付ごとにイベントをマッピング
    const eventsByDate = buildEventsByDateMap();

    // カレンダーのタイル内容
    const tileContent = ({ date }: { date: Date; view: string }) => {
      const dateStr = formatDateString(date);
      const events = eventsByDate.get(dateStr);

      if (events && events.length > 0) {
        return (
          <div className="calendar-events">
            {events.map((event) => {
              const titleValue = event.cells[titleColumnIndex];
              const titleStr =
                typeof titleValue === "string"
                  ? titleValue
                  : titleValue?.start || "Untitled";
              return (
                <a
                  key={event.id}
                  href={`command:${openPageCommand}?${encodeURI(
                    JSON.stringify({ id: event.id } as OpenPageCommandArgs),
                  )}`}
                  className="calendar-event-link"
                  title={titleStr}
                >
                  {titleStr}
                </a>
              );
            })}
          </div>
        );
      }
      return null;
    };

    // イベントがある日付にクラスを追加
    const tileClassName = ({ date, view }: { date: Date; view: string }) => {
      if (view === "month") {
        const dateStr = formatDateString(date);

        if (eventsByDate.has(dateStr)) {
          return "has-events";
        }
      }
      return "";
    };

    // タイル（日付）クリック時にイベントページに遷移
    const onClickDay = (date: Date) => {
      const dateStr = formatDateString(date);

      const events = eventsByDate.get(dateStr);
      if (events && events.length > 0) {
        // 最初のイベントに遷移
        const firstEvent = events[0];
        const href = `command:${openPageCommand}?${encodeURI(
          JSON.stringify({ id: firstEvent.id } as OpenPageCommandArgs),
        )}`;
        // VS Code webviewでcommand: URLを発火させるためにa要素をDOMに追加してクリック
        const a = document.createElement("a");
        a.href = href;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    };

    return (
      <div className="notion-calendar">
        {db.description && (
          <p className="text-lg italic text-gray-300 mb-6">{db.description}</p>
        )}
        <Calendar
          tileContent={tileContent}
          tileClassName={tileClassName}
          onClickDay={onClickDay}
        />
      </div>
    );
  };

  return renderCalendar;
};
