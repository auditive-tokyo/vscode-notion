import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import "react-calendar/dist/Calendar.css";
import type { CommandId } from "@/constants";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import {
  usePageCover,
  useTableRenderer,
  useCalendarRenderer,
  useTimelineRenderer,
  useMarkdownWithInlineDatabases,
} from "./hooks";
import "./styles.css";

// Assertion because we can't actually import enum into here.
const openPageCommand: `${CommandId.OpenPage}` = "notion.openPage";

declare global {
  interface Window {
    vscode: {
      getState: () => NotionWebviewState;
      setState: (state: NotionWebviewState) => void;
    };
  }
}

const root = createRoot(document.getElementById("root")!);
const state = window.vscode.getState();
console.log("[webview] state received:", state);

// メインアプリケーションコンポーネント
const App: React.FC = () => {
  const [viewModes, setViewModes] = useState<
    Record<string, "calendar" | "timeline" | "table" | "board">
  >(state.viewModes || {});

  const setViewMode = (
    databaseId: string,
    mode: "calendar" | "timeline" | "table" | "board",
  ) => {
    const newViewModes = {
      ...viewModes,
      [databaseId]: mode,
    };
    setViewModes(newViewModes);

    // Save to VS Code state
    const updatedState: NotionWebviewState = {
      ...state,
      viewModes: newViewModes,
    };
    window.vscode.setState(updatedState);

    console.log(
      "[webview] setViewMode called for databaseId:",
      databaseId,
      "newMode:",
      mode,
    );
  };

  if (!state || !state.data) {
    return (
      <div className="p-5 text-red-500">Error: No page data available</div>
    );
  }

  console.log("[webview] rendering markdown with length:", state.data.length);
  console.log("[webview] state.tableData:", state.tableData);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const renderCover = usePageCover(state);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { renderTable, renderBoard } = useTableRenderer(state, openPageCommand);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const renderCalendar = useCalendarRenderer(state, openPageCommand);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { renderTimeline } = useTimelineRenderer(state, openPageCommand);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const renderMarkdownWithInlineDatabases = useMarkdownWithInlineDatabases(
    state,
    openPageCommand,
    viewModes,
    setViewMode,
    renderCalendar,
    renderTimeline,
    renderTable,
    renderBoard,
    [remarkGfm, remarkBreaks],
  );

  if (!state || !state.data) {
    return (
      <div className="p-5 text-red-500">Error: No page data available</div>
    );
  }

  // テーブルをレンダリング（full page DB と inline DB で共通使用）
  const renderTableWrapper = (
    tableData: { columns: string[]; rows: { id: string; cells: string[] }[] },
    showDescription = true,
    viewType?: "table" | "calendar" | "timeline",
    currentViewMode?: "table" | "calendar" | "timeline" | "board",
  ) => {
    // For full-page databases, convert to inline database format for rendering
    if (viewType && state.datePropertyName && currentViewMode) {
      const dbWrapper: NonNullable<typeof state.inlineDatabases>[number] = {
        databaseId: state.id,
        title: state.title,
        viewType: viewType as "table" | "calendar" | "timeline",
        datePropertyName: state.datePropertyName,
        statusColorMap: state.statusColorMap,
        tableData: tableData as {
          columns: string[];
          rows: {
            id: string;
            cells: (string | { start: string | null; end: string | null })[];
          }[];
        },
      };

      if (currentViewMode === "calendar") {
        return renderCalendar(dbWrapper);
      } else if (currentViewMode === "timeline") {
        return renderTimeline(dbWrapper);
      }
    }

    // Check for board view (status column exists but no date, and NOT requesting table view)
    const hasStatusColumn = tableData.columns.some(
      (col) => col.toLowerCase() === "status",
    );
    if (
      hasStatusColumn &&
      !state.datePropertyName &&
      currentViewMode !== "table"
    ) {
      return renderBoard(
        tableData as {
          columns: string[];
          rows: {
            id: string;
            cells: (string | { start: string | null; end: string | null })[];
          }[];
        },
        state.statusColorMap,
      );
    }

    return renderTable(tableData, showDescription);
  };

  // テーブルデータがあった場合のレンダリング
  const renderContent = () => {
    if (state.tableData) {
      console.log("[webview] Rendering table with tableData:", state.tableData);
      console.log("[webview] viewType:", state.viewType);

      // Full-page database: ビューモード検出
      const hasStatusColumn = state.tableData.columns.some(
        (col) => col.toLowerCase() === "status",
      );
      const defaultViewMode: "calendar" | "timeline" | "table" | "board" =
        state.datePropertyName
          ? "calendar"
          : hasStatusColumn
          ? "board"
          : "table";
      const currentViewMode = viewModes[state.id] || defaultViewMode;
      const isCalendarView =
        currentViewMode === "calendar" && state.datePropertyName;
      const isTimelineView =
        currentViewMode === "timeline" && state.datePropertyName;
      const isBoardView = currentViewMode === "board" && hasStatusColumn;

      console.log("[webview] Full-page DB render:", {
        databaseId: state.id,
        currentViewMode,
        isCalendarView,
        isTimelineView,
        isBoardView,
        hasStatusColumn,
        viewType: state.viewType,
      });

      // ビューモード切り替えドロップダウン
      const availableModesFullPage: Array<
        "table" | "calendar" | "timeline" | "board"
      > = [];

      if (state.datePropertyName) {
        availableModesFullPage.push("calendar");
        availableModesFullPage.push("timeline"); // Always available when date exists
      }
      if (hasStatusColumn) {
        availableModesFullPage.push("board");
      }
      availableModesFullPage.push("table");

      const getModeLabel = (
        mode: "table" | "calendar" | "timeline" | "board",
      ) => {
        const labels: Record<
          "table" | "calendar" | "timeline" | "board",
          string
        > = {
          table: "📋 Table",
          calendar: "📅 Calendar",
          timeline: "📈 Timeline",
          board: "📊 Board",
        };
        return labels[mode];
      };

      const toggleViewButton =
        availableModesFullPage.length > 1 ? (
          <select
            className="view-selector"
            value={currentViewMode}
            onChange={(e) =>
              setViewMode(
                state.id,
                e.target.value as "table" | "calendar" | "timeline" | "board",
              )
            }
            style={{ minWidth: "120px" }}
          >
            {availableModesFullPage.map((mode) => (
              <option key={mode} value={mode}>
                {getModeLabel(mode)}
              </option>
            ))}
          </select>
        ) : null;

      const renderActualContent = () => {
        if (isTimelineView) {
          return renderTableWrapper(
            state.tableData,
            true,
            state.viewType,
            currentViewMode,
          );
        } else if (isCalendarView) {
          return renderTableWrapper(
            state.tableData,
            true,
            state.viewType,
            currentViewMode,
          );
        } else if (isBoardView) {
          return renderBoard(state.tableData, state.statusColorMap);
        } else {
          return renderTableWrapper(
            state.tableData,
            true,
            undefined,
            currentViewMode,
          );
        }
      };

      return (
        <div className="min-h-screen py-8 px-4">
          <div className="page-container">
            {renderCover()}
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeRaw]}
            >
              {state.data}
            </ReactMarkdown>
            {toggleViewButton && (
              <div className="flex items-center justify-between mb-4">
                <div></div>
                {toggleViewButton}
              </div>
            )}
            {renderActualContent()}
          </div>
        </div>
      );
    }

    // テーブルデータがない場合は Markdown をレンダリング
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="page-container">
          {renderCover()}
          {state.description && (
            <p className="text-lg italic text-gray-300 mb-6">
              {state.description}
            </p>
          )}
          {renderMarkdownWithInlineDatabases()}
        </div>
      </div>
    );
  };

  return renderContent();
};

root.render(<App />);
