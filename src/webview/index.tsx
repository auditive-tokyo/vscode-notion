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
  >({});

  const toggleViewMode = (databaseId: string) => {
    const db =
      state.inlineDatabases?.find((d) => d.databaseId === databaseId) || null;
    const hasDate = state.datePropertyName || db?.datePropertyName;
    const hasStatus =
      state.tableData?.columns?.some((col) => col.toLowerCase() === "status") ||
      db?.tableData.columns?.some((col) => col.toLowerCase() === "status");

    // Calculate default mode
    let defaultMode: "calendar" | "timeline" | "table" | "board" = "table";
    if (hasDate) {
      const viewType = state.viewType || db?.viewType;
      defaultMode = viewType === "timeline" ? "timeline" : "calendar";
    } else if (hasStatus) {
      defaultMode = "board";
    }

    const currentMode = viewModes[databaseId] || defaultMode;
    let nextMode: "calendar" | "timeline" | "table" | "board";

    // Cycle through available modes based on what data exists
    if (currentMode === "calendar") {
      nextMode = "timeline";
    } else if (currentMode === "timeline") {
      nextMode = hasStatus ? "board" : "table";
    } else if (currentMode === "board") {
      nextMode = "table";
    } else {
      // From table mode
      nextMode = hasDate ? "calendar" : hasStatus ? "board" : "table";
    }

    setViewModes({
      ...viewModes,
      [databaseId]: nextMode,
    });
    console.log(
      "[webview] toggleViewMode called for databaseId:",
      databaseId,
      "currentMode:",
      currentMode,
      "nextMode:",
      nextMode,
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
    toggleViewMode,
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
  ) => {
    // For full-page databases, convert to inline database format for rendering
    if (viewType && state.datePropertyName) {
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

      if (viewType === "calendar") {
        return renderCalendar(dbWrapper);
      } else if (viewType === "timeline") {
        return renderTimeline(dbWrapper);
      }
    }

    // Check for board view (status column exists but no date)
    const hasStatusColumn = tableData.columns.some(
      (col) => col.toLowerCase() === "status",
    );
    if (hasStatusColumn && !state.datePropertyName) {
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
        state.viewType ? state.viewType : hasStatusColumn ? "board" : "table";
      const currentViewMode = viewModes[state.id] || defaultViewMode;
      const isCalendarView =
        currentViewMode === "calendar" &&
        state.viewType === "calendar" &&
        state.datePropertyName;
      const isTimelineView =
        currentViewMode === "timeline" &&
        state.viewType === "timeline" &&
        state.datePropertyName;
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

      // ビューモード切り替えボタン
      let toggleViewButton: React.ReactElement | null = null;
      if (state.viewType === "timeline") {
        toggleViewButton = (
          <button
            className="view-toggle-btn"
            onClick={() => toggleViewMode(state.id)}
          >
            {currentViewMode === "timeline"
              ? "📋 Table View"
              : "📈 Timeline View"}
          </button>
        );
      } else if (state.viewType === "calendar") {
        toggleViewButton = (
          <button
            className="view-toggle-btn"
            onClick={() => toggleViewMode(state.id)}
          >
            {isCalendarView ? "📋 Table View" : "📅 Calendar View"}
          </button>
        );
      } else if (hasStatusColumn) {
        toggleViewButton = (
          <button
            className="view-toggle-btn"
            onClick={() => toggleViewMode(state.id)}
          >
            {isBoardView ? "📋 Table View" : "📊 Board View"}
          </button>
        );
      }

      const renderActualContent = () => {
        if (isTimelineView) {
          return renderTableWrapper(state.tableData, true, state.viewType);
        } else if (isCalendarView) {
          return renderTableWrapper(state.tableData, true, state.viewType);
        } else if (isBoardView) {
          return renderBoard(state.tableData, state.statusColorMap);
        } else {
          return renderTableWrapper(state.tableData, true);
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
