import React from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CommandId } from "../constants";
import type { NotionWebviewState } from "../ui/notion-page-viewer";
import type { OpenPageCommandArgs } from "../ui/open-page-command";

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
    <div style={{ padding: "20px", color: "red" }}>
      Error: No page data available
    </div>,
  );
} else {
  console.log("[webview] rendering markdown with length:", state.data.length);
  root.render(
    <div className="notion">
      <div className="notion-page">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => {
              const href = props.href || "";
              if (href.startsWith("/")) {
                const args = JSON.stringify({
                  id: href.slice(1),
                } as OpenPageCommandArgs);
                return (
                  <a
                    {...props}
                    href={`command:${openPageCommand}?${encodeURI(args)}`}
                    className="notion-link"
                  >
                    {props.children}
                  </a>
                );
              }
              return <a {...props} className="notion-link" />;
            },
            h1: ({ node, ...props }) => (
              <h1 {...props} className="notion-h notion-h1" />
            ),
            h2: ({ node, ...props }) => (
              <h2 {...props} className="notion-h notion-h2" />
            ),
            h3: ({ node, ...props }) => (
              <h3 {...props} className="notion-h notion-h3" />
            ),
            p: ({ node, ...props }) => <p {...props} className="notion-text" />,
            ul: ({ node, ...props }) => (
              <ul {...props} className="notion-list notion-list-disc" />
            ),
            ol: ({ node, ...props }) => (
              <ol {...props} className="notion-list notion-list-numbered" />
            ),
            li: ({ node, ...props }) => <li {...props} />,
            code: ({ node, inline, className, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || "");
              return inline ? (
                <code {...props} className="notion-inline-code" />
              ) : !inline && match ? (
                <pre className="notion-code">
                  <code {...props} className={className} />
                </pre>
              ) : (
                <code {...props} className="notion-inline-code" />
              );
            },
            blockquote: ({ node, ...props }) => (
              <blockquote {...props} className="notion-quote" />
            ),
            table: ({ node, ...props }) => (
              <div className="notion-table">
                <div className="notion-table-view">
                  <table {...props} />
                </div>
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead {...props} className="notion-table-header" />
            ),
            tbody: ({ node, ...props }) => (
              <tbody {...props} className="notion-table-body" />
            ),
            tr: ({ node, ...props }) => (
              <tr {...props} className="notion-table-row" />
            ),
            th: ({ node, ...props }) => (
              <th
                {...props}
                className="notion-table-cell notion-table-cell-title"
              />
            ),
            td: ({ node, ...props }) => (
              <td
                {...props}
                className="notion-table-cell notion-table-cell-text"
              />
            ),
          }}
        >
          {state.data}
        </ReactMarkdown>
      </div>
    </div>,
  );
}
