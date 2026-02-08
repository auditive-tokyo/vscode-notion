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

    // pb パラメータ付きなら、そのまま返す
    if (/pb=/i.test(url)) {
      return url;
    }

    // 座標を抽出（@35.6811441,139.7644811）
    const coordMatch = url.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (coordMatch) {
      const [, lat, lng] = coordMatch;

      // 簡易版 pb パラメータを生成
      // 最小構成：座標 + ズームレベル + 言語
      const zoomLevel = 15;
      // TODO: Keep this simplified pb until we can reliably derive a proper embed payload.
      const pb = `!1m18!1m12!1m3!1d${3240}!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f${zoomLevel}!3m3!1m2!1sen!2sjp!4v${Date.now()}`;
      return `https://www.google.com/maps/embed?${pb}`;
    }

    return url;
  } catch {
    return url;
  }
}

export function blockToMarkdown(block: any): string {
  const type = block.type;
  const renderer = blockRenderers[type];
  if (!renderer) {
    console.warn(`[block-to-markdown] Unsupported block type: ${type}`);
    return "";
  }

  try {
    return renderer(block);
  } catch (error) {
    console.warn(
      `[block-to-markdown] Error converting block of type ${type}:`,
      error,
    );
    return "";
  }
}

function getRichTextPlainText(richText?: any[]): string {
  return richText?.map((t: any) => t.plain_text).join("") || "";
}

function renderParagraph(block: any): string {
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

function renderHeading(level: 1 | 2 | 3, block: any): string {
  const heading = block[`heading_${level}`];
  const text = getRichTextPlainText(heading?.rich_text);
  const isToggleable = heading?.is_toggleable || false;

  if (isToggleable) {
    // \n は HTML構造化のための区切り文字（コード側で生成）
    return `<details>\n<summary><h${level}>${text}</h${level}></summary>\n`;
  }

  const prefix = "#".repeat(level);
  return `${prefix} ${text}`;
}

function renderBulletedListItem(block: any): string {
  return `- ${getRichTextPlainText(block.bulleted_list_item?.rich_text)}`;
}

function renderNumberedListItem(block: any): string {
  return `1. ${getRichTextPlainText(block.numbered_list_item?.rich_text)}`;
}

function renderTodo(block: any): string {
  const checked = block.to_do?.checked || false;
  const text = getRichTextPlainText(block.to_do?.rich_text);
  const checkedAttr = checked ? " checked" : "";
  const checkedClass = checked ? " is-checked" : "";
  return `<div class="notion-todo${checkedClass}"><input type="checkbox" class="notion-todo-checkbox"${checkedAttr} tabindex="-1" aria-disabled="true" /> <span class="notion-todo-text">${text}</span></div>`;
}

function renderCode(block: any): string {
  const language = block.code?.language || "text";
  const code = getRichTextPlainText(block.code?.rich_text);
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

function renderImage(block: any): string {
  const imageUrl = block.image?.external?.url || block.image?.file?.url || "";
  const imageCaption = getRichTextPlainText(block.image?.caption);
  return `![${imageCaption}](${imageUrl})`;
}

function renderVideo(block: any): string {
  const videoUrl = block.video?.external?.url || block.video?.file?.url || "";
  const videoCaption = getRichTextPlainText(block.video?.caption);

  if (!videoUrl) {
    return "";
  }

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

function renderEmbed(block: any): string {
  const originalUrl = block.embed?.url || block.type_specific_data?.url || "";
  const embedCaption = getRichTextPlainText(block.embed?.caption);

  if (!originalUrl) {
    return "";
  }

  let embedUrl = originalUrl;
  const isGoogleMaps = /google\.com\/maps/i.test(originalUrl);

  // Google Maps URL を pb パラメータ形式に変換
  if (isGoogleMaps) {
    embedUrl = normalizeGoogleMapsEmbedUrl(originalUrl);
  }

  const caption = embedCaption
    ? `<p class="embed-caption">${embedCaption}</p>`
    : "";

  const mapsOverlay = isGoogleMaps
    ? `<a href="${originalUrl}" target="_blank" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.35); color: #ffffff; text-decoration: none; font-weight: 600;">📍 View on Google Maps</a>`
    : "";

  const iframeStyle = isGoogleMaps
    ? "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; filter: brightness(0.75) saturate(0.9);"
    : "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;";

  return `<div class="notion-embed" style="max-width: 560px; margin: 1em 0;">
  <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
    <iframe
      src="${embedUrl}"
      style="${iframeStyle}"
      title="Embedded content"
      allowfullscreen=""
      loading="lazy"
    ></iframe>
    ${mapsOverlay}
  </div>
  ${caption}
</div>`;
}

function renderChildPage(block: any): string {
  const pageId = block.id;
  const pageTitle = block.child_page?.title || "Untitled Page";
  return `📄 [${pageTitle}](/${pageId})`;
}

function renderChildDatabase(block: any): string {
  const databaseId = block.id;
  const databaseTitle = block.child_database?.title || "Untitled Database";
  // inline DB のプレースホルダーを返す（後で実データに置換される）
  return `__INLINE_DB_PLACEHOLDER__${databaseId}__${databaseTitle}__`;
}

function renderQuote(block: any): string {
  const text = getRichTextPlainText(block.quote?.rich_text);
  return `> ${text}`;
}

function renderCallout(block: any): string {
  const icon = block.callout?.icon?.emoji || "💡";
  const text = getRichTextPlainText(block.callout?.rich_text);
  // カスタムコードブロック記法で callout を表現
  return `\`\`\`callout\n${icon} ${text}\n\`\`\``;
}

function renderToggle(block: any): string {
  const text = getRichTextPlainText(block.toggle?.rich_text);
  // \n は HTML構造化のための区切り文字（コード側で生成）
  // Notion由来の Shift+Enter とは異なる
  return `<details>\n<summary>${text}</summary>\n`;
}

function renderDivider(): string {
  return "---";
}

function renderTable(): string {
  // テーブルは子ブロック（table_row）で処理するため、ここでは何も出力しない
  return "";
}

function renderTableRow(block: any): string {
  const cells = block.table_row?.cells || [];
  // 各セルのテキストを抽出
  const cellContents = cells.map((cellRichTexts: any[]) =>
    cellRichTexts.map((t: any) => t.plain_text || "").join(""),
  );
  // Markdown テーブル行として返す
  return `| ${cellContents.join(" | ")} |`;
}

const blockRenderers: Record<string, (block: any) => string> = {
  paragraph: renderParagraph,
  heading_1: (block) => renderHeading(1, block),
  heading_2: (block) => renderHeading(2, block),
  heading_3: (block) => renderHeading(3, block),
  bulleted_list_item: renderBulletedListItem,
  numbered_list_item: renderNumberedListItem,
  to_do: renderTodo,
  code: renderCode,
  image: renderImage,
  video: renderVideo,
  embed: renderEmbed,
  child_page: renderChildPage,
  child_database: renderChildDatabase,
  quote: renderQuote,
  callout: renderCallout,
  toggle: renderToggle,
  divider: renderDivider,
  table: renderTable,
  table_row: renderTableRow,
};

interface TableState {
  currentTableParentId: string | null;
  isFirstRowInCurrentTable: boolean;
}

function isToggleOrToggleHeading(block: any): boolean {
  if (block.type === "toggle") {
    return true;
  }

  return (
    (block.type === "heading_1" && block.heading_1?.is_toggleable) ||
    (block.type === "heading_2" && block.heading_2?.is_toggleable) ||
    (block.type === "heading_3" && block.heading_3?.is_toggleable)
  );
}

function shouldSkipChildren(block: any): boolean {
  return block.type === "child_page" || block.type === "child_database";
}

function processTableRow(block: any, state: TableState): string {
  const rowParentId = block.parent?.block_id;
  const cellCount = block.table_row?.cells?.length || 0;

  // 新しいテーブルの開始か判定
  if (rowParentId !== state.currentTableParentId) {
    state.currentTableParentId = rowParentId;
    state.isFirstRowInCurrentTable = true;
  }

  let result = blockToMarkdown(block) + "\n";

  // 最初の行の後にセパレータを挿入
  if (state.isFirstRowInCurrentTable) {
    const separator = `| ${new Array(cellCount).fill("---").join(" | ")} |\n`;
    result += separator;
    state.isFirstRowInCurrentTable = false;
  }

  return result;
}

async function processNormalBlock(
  block: any,
  getChildBlocks?: (blockId: string) => Promise<any[]>,
): Promise<string> {
  let result = blockToMarkdown(block) + "\n\n";

  // toggle または toggle heading で子要素がない場合は </details> で閉じる
  if (isToggleOrToggleHeading(block) && !block.has_children) {
    result += "</details>\n";
  }

  // 子ブロックがあれば再帰的に処理
  if (block.has_children && getChildBlocks && !shouldSkipChildren(block)) {
    try {
      const childBlocks = await getChildBlocks(block.id);
      const childMarkdown = await blocksToMarkdown(childBlocks, getChildBlocks);
      result += childMarkdown.endsWith("\n\n")
        ? childMarkdown
        : childMarkdown + "\n\n";

      // toggle または toggle heading の場合は </details> で閉じる
      if (isToggleOrToggleHeading(block)) {
        result += "</details>\n";
      }
    } catch (error) {
      console.warn("[block-to-markdown] Failed to get child blocks:", error);
    }
  }

  return result;
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
  const tableState: TableState = {
    currentTableParentId: null,
    isFirstRowInCurrentTable: false,
  };

  for (const block of blocks) {
    if (block.type === "table_row") {
      markdown += processTableRow(block, tableState);
    } else {
      markdown += await processNormalBlock(block, getChildBlocks);

      // テーブルコンテキストをリセット
      if (block.type !== "table") {
        tableState.currentTableParentId = null;
        tableState.isFirstRowInCurrentTable = false;
      }
    }
  }

  return markdown;
}
