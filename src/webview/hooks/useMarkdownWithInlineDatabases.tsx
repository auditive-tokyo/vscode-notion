import React, { type ComponentProps, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { PluggableList } from "unified";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "@/ui/open-page-command";
import type { CommandId } from "@/constants";
import { MermaidDiagram } from "../components";
import rehypeTableHeaders from "./rehypeTableHeaders";

/**
 * inline DB プレースホルダーを検出してテーブルを挿入
 */
type InlineDbRenderers = {
  renderCalendar: (
    db: NonNullable<NotionWebviewState["inlineDatabases"]>[number],
  ) => React.ReactElement;
  renderTimeline: (
    db: NonNullable<NotionWebviewState["inlineDatabases"]>[number],
  ) => React.ReactElement;
  renderTable: (
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
    },
    showDescription?: boolean,
  ) => React.ReactElement;
  renderBoard: (
    tableData: {
      columns: string[];
      rows: {
        id: string;
        cells: (string | { start: string | null; end: string | null })[];
      }[];
    },
    statusColorMap?: Record<string, string>,
  ) => React.ReactElement;
};

export const useMarkdownWithInlineDatabases = (
  state: NotionWebviewState,
  openPageCommand: `${CommandId.OpenPage}`,
  viewModes: Record<string, "calendar" | "timeline" | "table" | "board">,
  setViewMode: (
    databaseId: string,
    mode: "calendar" | "timeline" | "table" | "board",
  ) => void,
  renderers: InlineDbRenderers,
  remarkPlugins: PluggableList,
) => {
  const { renderCalendar, renderTimeline, renderTable, renderBoard } =
    renderers;

  const renderMarkdownWithInlineDatabases = useCallback(() => {
    /**
     * ビューモード判定ロジック
     */
    function determineDefaultViewMode(
      inlineDb: NonNullable<typeof state.inlineDatabases>[number],
      hasStatusColumn: boolean,
    ): "calendar" | "timeline" | "table" | "board" {
      if (inlineDb.datePropertyName) {
        return inlineDb.viewType === "timeline" ? "timeline" : "calendar";
      }
      if (hasStatusColumn) {
        return "board";
      }
      return "table";
    }

    /**
     * 利用可能なビューモード一覧を取得
     */
    function getAvailableViewModes(
      hasDateProperty: boolean,
      hasStatusColumn: boolean,
    ): Array<"table" | "calendar" | "timeline" | "board"> {
      const modes: Array<"table" | "calendar" | "timeline" | "board"> = [];
      if (hasDateProperty) {
        modes.push("calendar");
        modes.push("timeline");
      }
      if (hasStatusColumn) {
        modes.push("board");
      }
      modes.push("table");
      return modes;
    }

    /**
     * モードのラベルを取得
     */
    function getModeLabel(mode: "table" | "calendar" | "timeline" | "board") {
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
    }

    /**
     * ビューモード状態をチェック
     */
    function checkViewModeStates(
      currentViewMode: string,
      inlineDb: NonNullable<typeof state.inlineDatabases>[number],
      hasStatusColumn: boolean,
    ) {
      return {
        isCalendarView:
          currentViewMode === "calendar" && !!inlineDb.datePropertyName,
        isTimelineView:
          currentViewMode === "timeline" && !!inlineDb.datePropertyName,
        isBoardView: currentViewMode === "board" && hasStatusColumn,
      };
    }

    /**
     * ビューモード別コンテンツをレンダリング
     */
    function renderDbContent(
      viewModeStates: ReturnType<typeof checkViewModeStates>,
      inlineDb: NonNullable<typeof state.inlineDatabases>[number],
    ): React.ReactElement {
      const { isTimelineView, isCalendarView, isBoardView } = viewModeStates;
      if (isTimelineView) {
        return renderTimeline(inlineDb);
      }
      if (isCalendarView) {
        return renderCalendar(inlineDb);
      }
      if (isBoardView) {
        return renderBoard(inlineDb.tableData, inlineDb.statusColorMap);
      }
      return renderTable(inlineDb.tableData, false);
    }

    /**
     * ビューモードに応じたアイコンを取得
     */
    function getViewIcon(
      viewModeStates: ReturnType<typeof checkViewModeStates>,
    ) {
      const { isTimelineView, isCalendarView, isBoardView } = viewModeStates;
      if (isTimelineView) return "📈";
      if (isCalendarView) return "📅";
      if (isBoardView) return "📊";
      return "📋";
    }

    /**
     * インラインDBコンポーネントを構築
     */
    function buildInlineDbComponent(
      index: number,
      databaseId: string,
      title: string,
      inlineDb: NonNullable<typeof state.inlineDatabases>[number],
      marker: string,
    ): React.ReactElement {
      const hasStatusColumn = inlineDb.tableData.columns.some(
        (col) => col.toLowerCase() === "status",
      );
      const hasDateProperty = !!inlineDb.datePropertyName;
      const defaultViewMode = determineDefaultViewMode(
        inlineDb,
        hasStatusColumn,
      );
      const currentViewMode = viewModes[databaseId] || defaultViewMode;
      const availableModes = getAvailableViewModes(
        hasDateProperty,
        hasStatusColumn,
      );
      const viewModeStates = checkViewModeStates(
        currentViewMode,
        inlineDb,
        hasStatusColumn,
      );

      const dbContent = renderDbContent(viewModeStates, inlineDb);
      const icon = getViewIcon(viewModeStates);

      const viewSelector = (
        <select
          className="view-selector"
          value={currentViewMode}
          onChange={(e) =>
            setViewMode(
              databaseId,
              e.target.value as "table" | "calendar" | "timeline" | "board",
            )
          }
          style={{ minWidth: "120px" }}
        >
          {availableModes.map((mode) => (
            <option key={mode} value={mode}>
              {getModeLabel(mode)}
            </option>
          ))}
        </select>
      );

      return (
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
            {viewSelector}
          </div>
          {dbContent}
        </div>
      );
    }

    /**
     * プレースホルダーをマーカーに置換し、コンポーネントを準備
     */
    function processPlaceholdersAndComponents(): {
      markdown: string;
      inlineDbComponents: React.ReactElement[];
    } {
      let markdown = state.data;
      const inlineDbComponents: React.ReactElement[] = [];
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

          const component = buildInlineDbComponent(
            index,
            databaseId,
            title,
            inlineDb,
            marker,
          );
          inlineDbComponents.push(component);
          index++;
        }
      }

      return { markdown, inlineDbComponents };
    }

    const { markdown, inlineDbComponents } = processPlaceholdersAndComponents();

    /**
     * ReactMarkdownのカスタムコンポーネント定義を取得
     */
    function getMarkdownComponents() {
      return {
        a: (
          props: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
            children?: React.ReactNode;
          },
        ) => {
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
          return <a {...props}>{props.children}</a>;
        },
        ul: (
          props: React.HTMLAttributes<HTMLUListElement> & {
            children?: React.ReactNode;
          },
        ) => <ul className="list-disc" {...props} />,
        ol: (
          props: React.HTMLAttributes<HTMLOListElement> & {
            children?: React.ReactNode;
          },
        ) => <ol className="list-decimal" {...props} />,
        pre: (
          props: React.HTMLAttributes<HTMLPreElement> & {
            children?: React.ReactNode;
          },
        ) => {
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
        input: (props: ComponentProps<"input">) => (
          <input {...props} readOnly />
        ),
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

          if (inline) {
            return <code {...props}>{children}</code>;
          }
          if (match) {
            return <code {...props} className={className}>
              {children}
            </code>;
          }
          return <code {...props}>{children}</code>;
        },
      };
    }

    /**
     * マークダウンとインラインDB要素を構築
     */
    function buildElements(
      markdown: string,
      inlineDbComponents: React.ReactElement[],
    ): (React.ReactElement | string)[] {
      const parts = markdown.split(/___INLINE_DB_(\d+)___/);
      const elements: (React.ReactElement | string)[] = [];
      const markdownComponents = getMarkdownComponents();

      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          // markdown部分
          if (parts[i].trim()) {
            elements.push(
              <ReactMarkdown
                key={`md-${i}`}
                remarkPlugins={remarkPlugins}
                rehypePlugins={[rehypeRaw, rehypeTableHeaders] as PluggableList}
                components={markdownComponents}
              >
                {parts[i]}
              </ReactMarkdown>,
            );
          }
        } else {
          // inline DB部分
          const dbIndex = Number.parseInt(parts[i], 10);
          if (inlineDbComponents[dbIndex]) {
            elements.push(inlineDbComponents[dbIndex]);
          }
        }
      }

      return elements;
    }

    const elements = buildElements(markdown, inlineDbComponents);

    return <>{elements}</>;
  }, [
    state,
    openPageCommand,
    viewModes,
    setViewMode,
    renderCalendar,
    renderTimeline,
    renderTable,
    renderBoard,
    remarkPlugins,
  ]);

  return renderMarkdownWithInlineDatabases;
};
