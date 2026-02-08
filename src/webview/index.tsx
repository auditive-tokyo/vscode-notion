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
      postMessage: (message: unknown) => void;
    };
  }
}

const root = createRoot(document.getElementById("root")!);
const state = window.vscode.getState();

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

    // Notify extension to save viewModes to disk cache
    window.vscode.postMessage({
      command: "saveViewModes",
      viewModes: newViewModes,
    });
  };

  if (!state || !state.data) {
    return (
      <div className="p-5 text-red-500">Error: No page data available</div>
    );
  }

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

  type FullPageViewMode = "calendar" | "timeline" | "table" | "board";

  const getDefaultFullPageViewMode = (
    hasDateProperty: boolean,
    hasStatusColumn: boolean,
    viewType?: "table" | "calendar" | "timeline",
  ): FullPageViewMode => {
    if (hasDateProperty) {
      return viewType === "timeline" ? "timeline" : "calendar";
    }
    if (hasStatusColumn) {
      return "board";
    }
    return "table";
  };

  const getFullPageViewStates = (
    currentViewMode: FullPageViewMode,
    hasDateProperty: boolean,
    hasStatusColumn: boolean,
  ) => {
    return {
      isCalendarView: currentViewMode === "calendar" && hasDateProperty,
      isTimelineView: currentViewMode === "timeline" && hasDateProperty,
      isBoardView: currentViewMode === "board" && hasStatusColumn,
    };
  };

  const getAvailableFullPageModes = (
    hasDateProperty: boolean,
    hasStatusColumn: boolean,
  ): FullPageViewMode[] => [
    ...(hasDateProperty
      ? (["calendar", "timeline"] as FullPageViewMode[])
      : []),
    ...(hasStatusColumn ? (["board"] as FullPageViewMode[]) : []),
    "table",
  ];

  const getModeLabel = (mode: FullPageViewMode) => {
    const labels: Record<FullPageViewMode, string> = {
      table: "📋 Table",
      calendar: "📅 Calendar",
      timeline: "📈 Timeline",
      board: "📊 Board",
    };
    return labels[mode];
  };

  // テーブルデータがあった場合のレンダリング
  const renderContent = () => {
    if (state.tableData) {
      // Full-page database: ビューモード検出
      const hasStatusColumn = state.tableData.columns.some(
        (col) => col.toLowerCase() === "status",
      );
      const hasDateProperty = !!state.datePropertyName;
      const defaultViewMode = getDefaultFullPageViewMode(
        hasDateProperty,
        hasStatusColumn,
        state.viewType,
      );
      const currentViewMode = viewModes[state.id] || defaultViewMode;
      const { isCalendarView, isTimelineView, isBoardView } =
        getFullPageViewStates(
          currentViewMode,
          hasDateProperty,
          hasStatusColumn,
        );

      // ビューモード切り替えドロップダウン
      const availableModesFullPage = getAvailableFullPageModes(
        hasDateProperty,
        hasStatusColumn,
      );

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
        if (isBoardView) {
          return renderBoard(state.tableData, state.statusColorMap);
        }
        return renderTableWrapper(
          state.tableData,
          true,
          isTimelineView || isCalendarView ? state.viewType : undefined,
          currentViewMode,
        );
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
