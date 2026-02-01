import React, { type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CommandId } from "../constants";
import type { NotionWebviewState } from "../ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "../ui/open-page-command";
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

if (!state || !state.data) {
  console.error("[webview] ERROR: No page data found in state");
  root.render(
    <div className="p-5 text-red-500">Error: No page data available</div>,
  );
} else {
  console.log("[webview] rendering markdown with length:", state.data.length);
  console.log("[webview] state.tableData:", state.tableData);

  // カバー画像をレンダリング
  const renderCover = () => {
    if (!state.coverUrl && !state.icon) return null;

    return (
      <div className="relative w-full mb-6">
        {/* カバー画像 */}
        {state.coverUrl && (
          <img
            src={state.coverUrl}
            alt="Page cover"
            className="block w-full h-[30vh] max-h-40 object-cover object-center rounded-none"
          />
        )}

        {/* アイコン（カバーの左下に絶対配置） */}
        {state.icon && (
          <div className="absolute bottom-0 left-6 translate-y-1/2">
            {state.icon.type === "emoji" ? (
              <span className="text-6xl drop-shadow-lg">{state.icon.emoji}</span>
            ) : state.icon.url ? (
              <img
                src={state.icon.url}
                alt="Page icon"
                className="w-20 h-20 rounded-lg shadow-lg object-cover"
              />
            ) : null}
          </div>
        )}
      </div>
    );
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
            {state.description && (
              <p className="text-lg italic text-gray-300 mb-6">{state.description}</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-600 px-4 py-2 bg-gray-800 text-left font-bold w-24">
                      ACTION
                    </th>
                    {state.tableData.columns.map((col: string) => (
                      <th
                        key={col}
                        className="border border-gray-600 px-4 py-2 bg-gray-800 text-left font-bold"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.tableData.rows.map(
                    (row: { id: string; cells: string[] }, idx: number) => (
                      <tr key={idx}>
                        <td className="border border-gray-600 px-4 py-2">
                          <a
                            href={`command:${openPageCommand}?${encodeURI(
                              JSON.stringify({
                                id: row.id,
                              } as OpenPageCommandArgs),
                            )}`}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm font-semibold transition inline-block no-underline"
                          >
                            OPEN
                          </a>
                        </td>
                        {row.cells.map((cell: string, cellIdx: number) => (
                          <td
                            key={cellIdx}
                            className="border border-gray-600 px-4 py-2"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
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
            <p className="text-lg italic text-gray-300 mb-6">{state.description}</p>
          )}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
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
                // callout の場合は pre スタイルを適用しない
                const code = props.children as React.ReactElement<{ className?: string }>;
                const isCallout = code?.props?.className?.includes("language-callout");
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
                
                // callout の特別処理
                if (!inline && language === "callout") {
                  return (
                    <div className="notion-callout">
                      {children}
                    </div>
                  );
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
            {state.data}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  root.render(renderContent());
}
