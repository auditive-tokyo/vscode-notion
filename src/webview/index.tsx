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
  root.render(
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
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
            code: ({
              inline,
              className,
              ...props
            }: ComponentProps<"code"> & {
              inline?: boolean;
              className?: string;
            }) => {
              const match = /language-(\w+)/.exec(className || "");
              return inline ? (
                <code {...props} />
              ) : !inline && match ? (
                <pre>
                  <code {...props} className={className} />
                </pre>
              ) : (
                <code {...props} />
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
    </div>,
  );
}
