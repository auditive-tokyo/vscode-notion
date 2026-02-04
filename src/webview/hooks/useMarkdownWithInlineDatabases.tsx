import React, { type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import type { PluggableList } from "unified";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";
import { MermaidDiagram } from "../components";

/**
 * inline DB プレースホルダーを検出してテーブルを挿入
 */
export const useMarkdownWithInlineDatabases = (
  state: NotionWebviewState,
  openPageCommand: `${CommandId.OpenPage}`,
  viewModes: Record<string, "calendar" | "timeline" | "table">,
  toggleViewMode: (databaseId: string) => void,
  renderCalendar: (
    db: NonNullable<typeof state.inlineDatabases>[number],
  ) => React.ReactElement,
  renderTimeline: (
    db: NonNullable<typeof state.inlineDatabases>[number],
  ) => React.ReactElement,
  renderTable: (
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
    },
    showDescription?: boolean,
  ) => React.ReactElement,
  remarkPlugins: PluggableList,
) => {
  const renderMarkdownWithInlineDatabases = () => {
    let markdown = state.data;
    const inlineDbComponents: React.ReactElement[] = [];

    console.log("[webview] state.inlineDatabases:", state.inlineDatabases);
    console.log("[webview] markdown content:", markdown);

    // プレースホルダーを特殊マーカーに置換し、コンポーネントを準備
    const placeholderPattern = /__INLINE_DB_PLACEHOLDER__([^_]+)__(.+?)__/g;
    let match;
    let index = 0;

    while ((match = placeholderPattern.exec(state.data)) !== null) {
      const [fullMatch, databaseId, title] = match;
      const inlineDb = state.inlineDatabases?.find(
        (db) => db.databaseId === databaseId,
      );

      if (inlineDb) {
        const marker = `___INLINE_DB_${index}___`;
        markdown = markdown.replace(fullMatch, marker);

        // デフォルトビューモード: timeline > calendar > table の優先順位
        let defaultViewMode: "calendar" | "timeline" | "table" = "table";
        if (inlineDb.datePropertyName) {
          defaultViewMode =
            inlineDb.viewType === "timeline" ? "timeline" : "calendar";
        }

        const currentViewMode = viewModes[databaseId] || defaultViewMode;
        const isCalendarView =
          currentViewMode === "calendar" &&
          inlineDb.viewType === "calendar" &&
          inlineDb.datePropertyName;
        const isTimelineView =
          currentViewMode === "timeline" &&
          inlineDb.viewType === "timeline" &&
          inlineDb.datePropertyName;

        console.log("[webview] DB render:", {
          databaseId,
          currentViewMode,
          isCalendarView,
          isTimelineView,
          viewType: inlineDb.viewType,
        });

        // ビューモード切り替えボタン
        let toggleViewButton: React.ReactElement | null = null;
        if (inlineDb.viewType === "timeline") {
          toggleViewButton = (
            <button
              className="view-toggle-btn"
              onClick={() => toggleViewMode(databaseId)}
            >
              {currentViewMode === "timeline"
                ? "📊 Table View"
                : "📈 Timeline View"}
            </button>
          );
        } else if (inlineDb.viewType === "calendar") {
          toggleViewButton = (
            <button
              className="view-toggle-btn"
              onClick={() => toggleViewMode(databaseId)}
            >
              {isCalendarView ? "📊 Table View" : "📅 Calendar View"}
            </button>
          );
        }

        // ビューモード別にコンテンツをレンダリング
        let dbContent: React.ReactElement;
        if (isTimelineView) {
          dbContent = renderTimeline(inlineDb);
        } else if (isCalendarView) {
          dbContent = renderCalendar(inlineDb);
        } else {
          dbContent = renderTable(inlineDb.tableData, false);
        }

        // アイコンを表示
        let icon = "📊";
        if (isTimelineView) {
          icon = "📈";
        } else if (isCalendarView) {
          icon = "📅";
        }

        inlineDbComponents.push(
          <div
            key={index}
            className="my-6"
            data-marker={marker}
            data-db-index={index}
          >
            <div className="flex items-center mb-4">
              <h3 className="text-xl font-semibold grow">
                {icon} {title}
              </h3>
              {toggleViewButton}
            </div>
            {dbContent}
          </div>,
        );
        index++;
      }
    }

    // markdownを分割してテーブルを挿入
    const parts = markdown.split(/___INLINE_DB_(\d+)___/);
    const elements: (React.ReactElement | string)[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // markdown部分
        if (parts[i].trim()) {
          elements.push(
            <ReactMarkdown
              key={`md-${i}`}
              remarkPlugins={remarkPlugins}
              components={{
                a: (props) => {
                  const href = props.href || "";
                  if (href.startsWith("/")) {
                    const args = JSON.stringify({
                      id: href.slice(1),
                    } as OpenPageCommandArgs);
                    return (
                      <a
                        {...props}
                        href={`command:${openPageCommand}?${encodeURI(args)}`}
                      >
                        {props.children}
                      </a>
                    );
                  }
                  return <a {...props} />;
                },
                h1: (props) => <h1 {...props} />,
                h2: (props) => <h2 {...props} />,
                h3: (props) => <h3 {...props} />,
                p: (props) => <p {...props} />,
                ul: (props) => <ul className="list-disc" {...props} />,
                ol: (props) => <ol className="list-decimal" {...props} />,
                li: (props) => <li {...props} />,
                pre: (props) => {
                  const code = props.children as React.ReactElement<{
                    className?: string;
                  }>;
                  const isCallout =
                    code?.props?.className?.includes("language-callout");
                  if (isCallout) {
                    return <>{props.children}</>;
                  }
                  return <pre {...props} />;
                },
                code: ({
                  inline,
                  className,
                  children,
                  ...props
                }: ComponentProps<"code"> & {
                  inline?: boolean;
                  className?: string;
                }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const language = match ? match[1] : null;

                  // Mermaid diagram rendering
                  if (!inline && language === "mermaid") {
                    const code = String(children).replace(/\n$/, "");
                    return <MermaidDiagram chart={code} />;
                  }

                  if (!inline && language === "callout") {
                    return <div className="notion-callout">{children}</div>;
                  }

                  return inline ? (
                    <code {...props}>{children}</code>
                  ) : !inline && match ? (
                    <code {...props} className={className}>
                      {children}
                    </code>
                  ) : (
                    <code {...props}>{children}</code>
                  );
                },
                blockquote: (props) => <blockquote {...props} />,
                table: (props) => <table {...props} />,
                thead: (props) => <thead {...props} />,
                tbody: (props) => <tbody {...props} />,
                tr: (props) => <tr {...props} />,
                th: (props) => <th {...props} />,
                td: (props) => <td {...props} />,
              }}
            >
              {parts[i]}
            </ReactMarkdown>,
          );
        }
      } else {
        // inline DB部分
        const dbIndex = parseInt(parts[i], 10);
        if (inlineDbComponents[dbIndex]) {
          elements.push(inlineDbComponents[dbIndex]);
        }
      }
    }

    return <>{elements}</>;
  };

  return renderMarkdownWithInlineDatabases;
};
