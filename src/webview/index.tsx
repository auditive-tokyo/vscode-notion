import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "react-calendar/dist/Calendar.css";
import type { CommandId } from "../constants";
import type { NotionWebviewState } from "../ui/notion-page-viewer";
import {
  usePageCover,
  useTableRenderer,
  useCalendarRenderer,
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
    Record<string, "calendar" | "table">
  >({});

  const toggleViewMode = (databaseId: string) => {
    const currentMode = viewModes[databaseId] || "calendar";
    setViewModes({
      ...viewModes,
      [databaseId]: currentMode === "calendar" ? "table" : "calendar",
    });
    console.log(
      "[webview] toggleViewMode called for databaseId:",
      databaseId,
      "newMode:",
      currentMode === "calendar" ? "table" : "calendar",
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
  const renderTable = useTableRenderer(state, openPageCommand);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const renderCalendar = useCalendarRenderer(state, openPageCommand);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const renderMarkdownWithInlineDatabases = useMarkdownWithInlineDatabases(
    state,
    openPageCommand,
    viewModes,
    toggleViewMode,
    renderCalendar,
    renderTable,
    [remarkGfm],
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
  ) => {
    return renderTable(tableData, showDescription);
  };

  // テーブルデータがあった場合のレンダリング
  const renderContent = () => {
    if (state.tableData) {
      console.log("[webview] Rendering table with tableData:", state.tableData);
      return (
        <div className="min-h-screen py-8 px-4">
          <div className="page-container">
            {renderCover()}
            <ReactMarkdown>{state.data}</ReactMarkdown>
            {renderTableWrapper(state.tableData, true)}
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
