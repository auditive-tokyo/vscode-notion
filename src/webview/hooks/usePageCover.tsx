import React from "react";
import type { NotionWebviewState } from "@/ui/notion-page-viewer";

/**
 * ページカバー画像とアイコンをレンダリング
 * - カバー画像あり: アイコンを左下に絶対配置
 * - カバー画像なし・アイコンあり: アイコンを上に単純配置
 */
export const usePageCover = (state: NotionWebviewState) => {
  const renderCover = () => {
    if (!state.coverUrl && !state.icon) return null;

    // ケース1: カバー画像がある場合 → アイコンを絶対配置で左下に
    if (state.coverUrl) {
      return (
        <div className="relative w-full mb-6">
          <img
            src={state.coverUrl}
            alt="Page cover"
            className="block w-full h-[30vh] max-h-40 object-cover object-center rounded-none"
          />
          {state.icon && (
            <div className="absolute bottom-0 left-6 translate-y-1/2">
              {(() => {
                if (state.icon.type === "emoji") {
                  return (
                    <span className="text-6xl drop-shadow-lg">
                      {state.icon.emoji}
                    </span>
                  );
                }
                if (state.icon.url) {
                  return (
                    <img
                      src={state.icon.url}
                      alt="Page icon"
                      className="w-20 h-20 rounded-lg shadow-lg object-cover"
                    />
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      );
    }

    // ケース2: カバー画像がなく、アイコンだけがある場合 → 上に単純に配置
    if (state.icon) {
      return (
        <div className="mb-6">
          {(() => {
            if (state.icon.type === "emoji") {
              return (
                <span className="text-5xl inline-block">
                  {state.icon.emoji}
                </span>
              );
            }
            if (state.icon.url) {
              return (
                <img
                  src={state.icon.url}
                  alt="Page icon"
                  className="w-16 h-16 rounded-lg object-cover"
                />
              );
            }
            return null;
          })()}
        </div>
      );
    }

    return null;
  };

  return renderCover;
};
