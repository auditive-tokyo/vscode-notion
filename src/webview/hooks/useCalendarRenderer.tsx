import React from "react";
import Calendar from "react-calendar";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";

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
      // ローカル時刻で日付文字列を作成（タイムゾーンのずれを防ぐ）
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

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

    // イベントがある日付にクラスを追加
    const tileClassName = ({ date, view }: { date: Date; view: string }) => {
      if (view === "month") {
        // ローカル時刻で日付文字列を作成（タイムゾーンのずれを防ぐ）
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

        if (eventsByDate.has(dateStr)) {
          return "has-events";
        }
      }
      return "";
    };

    // タイル（日付）クリック時にイベントページに遷移
    const onClickDay = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

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
        document.body.removeChild(a);
      }
    };

    return (
      <div className="notion-calendar">
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
