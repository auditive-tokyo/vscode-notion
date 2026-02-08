/**
 * Notion ブロックを Markdown に変換するユーティリティ
 * 各ブロック型に対応した変換ロジックを提供
 */

/**
 * 単一ブロックを Markdown に変換
 * @param block - Notion API から取得したブロックオブジェクト
 * @returns Markdown 形式の文字列
 */
function normalizeGoogleMapsEmbedUrl(url: string): string {
  try {
    const isGoogleHost = /(^|\.)google\./i.test(url);
    if (!isGoogleHost || !/\/maps/i.test(url)) {
      return url;
    }

    if (/\/maps\/embed/i.test(url) || /pb=/i.test(url)) {
      return url;
    }

    const coordMatch = url.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (coordMatch) {
      const [, lat, lng] = coordMatch;
      return `https://www.google.com/maps?embed&q=${lat},${lng}`;
    }

    const placeMatch = url.match(/\/maps\/(?:place|search)\/([^/@]+)/i);
    if (placeMatch?.[1]) {
      const place = placeMatch[1].replace(/\+/g, " ");
      return `https://www.google.com/maps?embed&q=${encodeURIComponent(place)}`;
    }

    return url;
  } catch {
    return url;
  }
}

export function blockToMarkdown(block: any): string {
  const type = block.type;

  try {
    switch (type) {
      case "paragraph": {
        const richTexts = block.paragraph?.rich_text || [];
        // Extract text from richTexts array
        // This preserves Shift+Enter (\n within richText) from Notion
        // which remark-breaks will convert to <br> tags
        // vs. Enter (separate paragraph blocks) which are handled separately
        const text = richTexts.map((rt: any) => rt.plain_text).join("");

        // \n\n を Markdown の段落区切りとして処理
        // （\n 1つは remark-breaks が <br> に変換）
        if (text.includes("\n\n")) {
          // \n\n で分割して、各部分を別の段落として返す
          const parts = text.split("\n\n").filter((p: string) => p.length > 0);
          return parts.join("\n\n"); // Markdownの段落区切り（空行）
        }

        return text;
      }

      case "heading_1": {
        const text =
          block.heading_1?.rich_text?.map((t: any) => t.plain_text).join("") ||
          "";
        const isToggleable = block.heading_1?.is_toggleable || false;
        if (isToggleable) {
          // \n は HTML構造化のための区切り文字（コード側で生成）
          return `<details>\n<summary><h1>${text}</h1></summary>\n`;
        }
        return `# ${text}`;
      }

      case "heading_2": {
        const text =
          block.heading_2?.rich_text?.map((t: any) => t.plain_text).join("") ||
          "";
        const isToggleable = block.heading_2?.is_toggleable || false;
        if (isToggleable) {
          // \n は HTML構造化のための区切り文字（コード側で生成）
          return `<details>\n<summary><h2>${text}</h2></summary>\n`;
        }
        return `## ${text}`;
      }

      case "heading_3": {
        const text =
          block.heading_3?.rich_text?.map((t: any) => t.plain_text).join("") ||
          "";
        const isToggleable = block.heading_3?.is_toggleable || false;
        if (isToggleable) {
          // \n は HTML構造化のための区切り文字（コード側で生成）
          return `<details>\n<summary><h3>${text}</h3></summary>\n`;
        }
        return `### ${text}`;
      }

      case "bulleted_list_item":
        return (
          "- " +
          (block.bulleted_list_item?.rich_text
            ?.map((t: any) => t.plain_text)
            .join("") || "")
        );

      case "numbered_list_item":
        return (
          "1. " +
          (block.numbered_list_item?.rich_text
            ?.map((t: any) => t.plain_text)
            .join("") || "")
        );

      case "to_do": {
        const checked = block.to_do?.checked || false;
        const text =
          block.to_do?.rich_text?.map((t: any) => t.plain_text).join("") || "";
        const checkedAttr = checked ? " checked" : "";
        const checkedClass = checked ? " is-checked" : "";
        return `<div class="notion-todo${checkedClass}"><input type="checkbox" class="notion-todo-checkbox"${checkedAttr} tabindex="-1" aria-disabled="true" /> <span class="notion-todo-text">${text}</span></div>`;
      }

      case "code": {
        const language = block.code?.language || "text";
        const code =
          block.code?.rich_text?.map((t: any) => t.plain_text).join("") || "";
        return `\`\`\`${language}\n${code}\n\`\`\``;
      }

      case "image": {
        const imageUrl =
          block.image?.external?.url || block.image?.file?.url || "";
        const imageCaption =
          block.image?.caption?.map((t: any) => t.plain_text).join("") || "";
        return `![${imageCaption}](${imageUrl})`;
      }

      case "video": {
        const videoUrl =
          block.video?.external?.url || block.video?.file?.url || "";
        const videoCaption =
          block.video?.caption?.map((t: any) => t.plain_text).join("") || "";

        if (!videoUrl) return "";

        // YouTube URL を埋め込み形式に変換
        let embedUrl = videoUrl;
        const youtubeMatch = videoUrl.match(
          /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/,
        );
        if (youtubeMatch) {
          const videoId = youtubeMatch[1];
          embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }

        // HTML iframe で埋め込み（VS Code Webview sandbox 対応）
        const caption = videoCaption
          ? `<p class="video-caption">${videoCaption}</p>`
          : "";
        return `<div class="notion-video" style="max-width: 560px; margin: 1em 0;">
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
    <iframe 
      src="${embedUrl}" 
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
      title="Video player"
    ></iframe>
  </div>
  ${caption}
</div>`;
      }

      case "embed": {
        let embedUrl = block.embed?.url || block.type_specific_data?.url || "";
        const embedCaption =
          block.embed?.caption?.map((t: any) => t.plain_text).join("") || "";

        if (!embedUrl) return "";

        const isGoogleMaps = /google\.com\/maps/i.test(embedUrl);
        if (isGoogleMaps) {
          // Google Maps はiframe で表示できないので、リンク形式で返す
          const placeMatch = embedUrl.match(/\/maps\/place\/([^/@]+)/);
          const placeName = placeMatch
            ? placeMatch[1].replace(/\+/g, " ")
            : "Location";
          return `[📍 ${placeName} on Google Maps](${embedUrl})`;
        }

        // その他の embed（YouTube など）は iframe で表示
        embedUrl = normalizeGoogleMapsEmbedUrl(embedUrl);

        const caption = embedCaption
          ? `<p class="embed-caption">${embedCaption}</p>`
          : "";

        return `<div class="notion-embed" style="max-width: 100%; margin: 1em 0;">
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
    <iframe
      src="${embedUrl}"
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
      title="Embedded content"
    ></iframe>
  </div>
  ${caption}
</div>`;
      }

      case "child_page": {
        const pageId = block.id;
        const pageTitle = block.child_page?.title || "Untitled Page";
        return `📄 [${pageTitle}](/${pageId})`;
      }

      case "child_database": {
        const databaseId = block.id;
        const databaseTitle =
          block.child_database?.title || "Untitled Database";
        // inline DB のプレースホルダーを返す（後で実データに置換される）
        return `__INLINE_DB_PLACEHOLDER__${databaseId}__${databaseTitle}__`;
      }

      case "quote": {
        const text =
          block.quote?.rich_text?.map((t: any) => t.plain_text).join("") || "";
        return `> ${text}`;
      }

      case "callout": {
        const icon = block.callout?.icon?.emoji || "💡";
        const text =
          block.callout?.rich_text?.map((t: any) => t.plain_text).join("") ||
          "";
        // カスタムコードブロック記法で callout を表現
        return `\`\`\`callout\n${icon} ${text}\n\`\`\``;
      }

      case "toggle": {
        const text =
          block.toggle?.rich_text?.map((t: any) => t.plain_text).join("") || "";
        // \n は HTML構造化のための区切り文字（コード側で生成）
        // Notion由来の Shift+Enter とは異なる
        return `<details>\n<summary>${text}</summary>\n`;
      }

      case "divider":
        return "---";

      case "table":
        // テーブルは子ブロック（table_row）で処理するため、ここでは何も出力しない
        return "";

      case "table_row": {
        const cells = block.table_row?.cells || [];
        // 各セルのテキストを抽出
        const cellContents = cells.map((cellRichTexts: any[]) =>
          cellRichTexts.map((t: any) => t.plain_text || "").join(""),
        );
        // Markdown テーブル行として返す
        return `| ${cellContents.join(" | ")} |`;
      }

      default:
        console.warn(`[block-to-markdown] Unsupported block type: ${type}`);
        return "";
    }
  } catch (error) {
    console.warn(
      `[block-to-markdown] Error converting block of type ${type}:`,
      error,
    );
    return "";
  }
}

/**
 * ブロック配列を Markdown に変換（再帰サポート）
 * @param blocks - ブロックの配列
 * @param getChildBlocks - 子ブロックを取得する非同期関数
 * @returns Markdown 形式の文字列
 */
export async function blocksToMarkdown(
  blocks: any[],
  getChildBlocks?: (blockId: string) => Promise<any[]>,
): Promise<string> {
  let markdown = "";
  let currentTableParentId: string | null = null;
  let isFirstRowInCurrentTable = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // テーブル行を処理
    if (block.type === "table_row") {
      const rowParentId = block.parent?.block_id;
      const cellCount = block.table_row?.cells?.length || 0;

      // 新しいテーブルの開始か判定
      if (rowParentId !== currentTableParentId) {
        currentTableParentId = rowParentId;
        isFirstRowInCurrentTable = true;
      }

      // テーブル行を追加
      markdown += blockToMarkdown(block) + "\n";

      // 最初の行の後にセパレータを挿入
      if (isFirstRowInCurrentTable) {
        const separator = `| ${new Array(cellCount)
          .fill("---")
          .join(" | ")} |\n`;
        markdown += separator;
        isFirstRowInCurrentTable = false;
      }
    } else {
      // テーブル行以外のブロック
      markdown += blockToMarkdown(block) + "\n\n";

      // toggle または toggle heading で子要素がない場合は </details> で閉じる
      const isToggle = block.type === "toggle";
      const isToggleHeading =
        (block.type === "heading_1" && block.heading_1?.is_toggleable) ||
        (block.type === "heading_2" && block.heading_2?.is_toggleable) ||
        (block.type === "heading_3" && block.heading_3?.is_toggleable);

      if ((isToggle || isToggleHeading) && !block.has_children) {
        markdown += "</details>\n";
      }

      // テーブルコンテキストをリセット
      if (block.type !== "table") {
        currentTableParentId = null;
        isFirstRowInCurrentTable = false;
      }
    }

    // child_page と child_database は子ブロックを取得しない
    // （孫ページまで表示されないようにする）
    const shouldSkipChildren =
      block.type === "child_page" || block.type === "child_database";

    // 子ブロックがあれば再帰的に処理
    if (block.has_children && getChildBlocks && !shouldSkipChildren) {
      try {
        const childBlocks = await getChildBlocks(block.id);
        const childMarkdown = await blocksToMarkdown(
          childBlocks,
          getChildBlocks,
        );
        markdown += childMarkdown.endsWith("\n\n")
          ? childMarkdown
          : childMarkdown + "\n\n";

        // toggle または toggle heading の場合は </details> で閉じる
        const isToggleBlock = block.type === "toggle";
        const isToggleHeadingBlock =
          (block.type === "heading_1" && block.heading_1?.is_toggleable) ||
          (block.type === "heading_2" && block.heading_2?.is_toggleable) ||
          (block.type === "heading_3" && block.heading_3?.is_toggleable);

        if (isToggleBlock || isToggleHeadingBlock) {
          markdown += "</details>\n";
        }
      } catch (error) {
        console.warn("[block-to-markdown] Failed to get child blocks:", error);
      }
    }
  }

  return markdown;
}
