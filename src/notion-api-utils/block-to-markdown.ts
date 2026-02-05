/**
 * Notion ブロックを Markdown に変換するユーティリティ
 * 各ブロック型に対応した変換ロジックを提供
 */

/**
 * 単一ブロックを Markdown に変換
 * @param block - Notion API から取得したブロックオブジェクト
 * @returns Markdown 形式の文字列
 */
export function blockToMarkdown(block: any): string {
  const type = block.type;

  try {
    switch (type) {
      case "paragraph": {
        const text =
          block.paragraph?.rich_text?.map((t: any) => t.plain_text).join("") ||
          "";
        // 空の段落は空行として扱う（remark-breaksが\nを<br>に変換）
        return text;
      }

      case "heading_1":
        return (
          "# " +
          (block.heading_1?.rich_text?.map((t: any) => t.plain_text).join("") ||
            "")
        );

      case "heading_2":
        return (
          "## " +
          (block.heading_2?.rich_text?.map((t: any) => t.plain_text).join("") ||
            "")
        );

      case "heading_3":
        return (
          "### " +
          (block.heading_3?.rich_text?.map((t: any) => t.plain_text).join("") ||
            "")
        );

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
        const checked = block.to_do?.checked ? "[x]" : "[ ]";
        const text =
          block.to_do?.rich_text?.map((t: any) => t.plain_text).join("") || "";
        return checked + " " + text;
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
        return `<details>\n<summary>${text}</summary>\n\n`;
      }

      case "divider":
        console.log(
          "[block-to-markdown] divider block:",
          JSON.stringify(block, null, 2),
        );
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
        console.log("[blocksToMarkdown] New table detected:", {
          tableId: rowParentId,
          cellCount,
        });
      }

      // テーブル行を追加
      markdown += blockToMarkdown(block) + "\n";

      // 最初の行の後にセパレータを挿入
      if (isFirstRowInCurrentTable) {
        const separator = `| ${Array(cellCount).fill("---").join(" | ")} |\n`;
        console.log(
          "[blocksToMarkdown] Adding separator with",
          cellCount,
          "columns",
        );
        markdown += separator;
        isFirstRowInCurrentTable = false;
      }
    } else {
      // テーブル行以外のブロック
      markdown += blockToMarkdown(block) + "\n";
      if (block.type === "toggle" && !block.has_children) {
        markdown += "</details>\n\n";
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
        markdown += childMarkdown;

        // toggle ブロックの場合は </details> で閉じる
        if (block.type === "toggle") {
          markdown += "</details>\n\n";
        }
      } catch (error) {
        console.warn("[block-to-markdown] Failed to get child blocks:", error);
      }
    }
  }

  return markdown;
}
