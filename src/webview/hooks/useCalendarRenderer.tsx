import React from "react";
import Calendar from "react-calendar";
import type { NotionWebviewState } from "../../ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "../../ui/open-page-command";
import type { CommandId } from "../../constants";

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

    // 日付ごとにイベントをマッピング
    const eventsByDate = new Map<
      string,
      (typeof db.tableData.rows)[number][]
    >();
    db.tableData.rows.forEach((row) => {
      const dateStr = row.cells[dateColumnIndex];
      if (dateStr) {
        if (!eventsByDate.has(dateStr)) {
          eventsByDate.set(dateStr, []);
        }
        eventsByDate.get(dateStr)!.push(row);
      }
    });

    // カレンダーのタイル内容
    const tileContent = ({ date }: { date: Date; view: string }) => {
      const dateStr = date.toISOString().split("T")[0];
      const events = eventsByDate.get(dateStr);

      if (events && events.length > 0) {
        return (
          <div className="calendar-events">
            {events.map((event, idx) => (
              <a
                key={idx}
                href={`command:${openPageCommand}?${encodeURI(
                  JSON.stringify({ id: event.id } as OpenPageCommandArgs),
                )}`}
                className="calendar-event-link"
                title={event.cells[titleColumnIndex]}
              >
                {event.cells[titleColumnIndex]}
              </a>
            ))}
          </div>
        );
      }
      return null;
    };

    return (
      <div className="notion-calendar">
        <Calendar tileContent={tileContent} />
      </div>
    );
  };

  return renderCalendar;
};
