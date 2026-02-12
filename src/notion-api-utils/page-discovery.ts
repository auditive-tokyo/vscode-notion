/**
 * Notion ページ階層を検出するユーティリティ
 * ページ内のリンク、子ページ、同期ブロックなどから関連ページを抽出
 */

export interface NotionPageTreeItem {
  id: string;
  title: string;
  type: "page" | "database";
}

/**
 * ブロックからすべてのページ/DB を抽出
 * child_page, child_database, 同期されたブロックなどを処理
 * @param block - Notion API ブロックオブジェクト
 * @returns 抽出されたページ/DB のリスト
 */
export function extractPagesAndDatabases(block: any): NotionPageTreeItem[] {
  const items: NotionPageTreeItem[] = [];

  if (!block) return items;

  switch (block.type) {
    case "child_page":
      items.push({
        id: block.id,
        title: block.child_page.title || "Untitled Page",
        type: "page",
      });
      break;

    case "child_database":
      items.push({
        id: block.id,
        title: block.child_database.title || "Untitled Database",
        type: "database",
      });
      break;

    case "synced_block":
      // 同期されたブロック - リンク先ページ/DB を取得
      if (block.synced_block?.synced_from) {
        const syncedBlockId = block.synced_block.synced_from.block_id;
        items.push({
          id: syncedBlockId,
          title: `Synced: ${block.synced_block.synced_from.block_id.slice(
            0,
            8,
          )}`,
          type: "page",
        });
      }
      break;

    // リッチテキスト内のメンション（@ユーザー、@ページなど）を処理
    case "paragraph":
    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "quote":
    case "bulleted_list_item":
    case "numbered_list_item":
    case "to_do":
    case "toggle":
      {
        const blockData = (block as any)[block.type];
        if (blockData?.rich_text) {
          const pageRefs = extractPageReferencesFromRichText(
            blockData.rich_text,
          );
          items.push(...pageRefs);
        }
      }
      break;
  }

  return items;
}

/**
 * リッチテキスト内のページメンション参照を抽出
 * @param richTexts - リッチテキストオブジェクトの配列
 * @returns 抽出されたページ参照のリスト
 */
/**
 * Mention型のテキストからページIDを抽出
 */
function extractPageIdFromMention(text: any): string | null {
  if (text.type === "mention" && text.mention?.type === "page") {
    return text.mention?.page?.id || null;
  }
  return null;
}

/**
 * hrefから複数の形式でページIDを抽出
 * Notion内部リンク形式を優先し、短いID形式はフォールバック
 */
function extractPageIdFromHref(
  href: string,
): { pageId: string; isFullMatch: boolean } | null {
  // Notion内部リンク形式（32文字）
  const notionRegex = /\/(?:workspace|database|page)\/([a-f0-9]{32})/;
  const notionMatch = notionRegex.exec(href);
  if (notionMatch) {
    return { pageId: notionMatch[1]!, isFullMatch: true };
  }

  // Notion内部リンク形式（ハイフン区切り）
  const dashedNotionRegex = /\/(?:workspace|database|page)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;
  const dashedNotionMatch = dashedNotionRegex.exec(href);
  if (dashedNotionMatch) {
    return { pageId: dashedNotionMatch[1]!, isFullMatch: true };
  }

  // 短いID形式（32文字）
  const shortRegex = /([a-f0-9]{32})/;
  const shortMatch = shortRegex.exec(href);
  if (shortMatch) {
    return { pageId: shortMatch[1]!, isFullMatch: false };
  }

  // 短いID形式（ハイフン区切り）
  const dashedRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;
  const dashedMatch = dashedRegex.exec(href);
  if (dashedMatch) {
    return { pageId: dashedMatch[1]!, isFullMatch: false };
  }

  return null;
}

/**
 * ページアイテムを作成
 */
function createPageItem(pageId: string, plainText: string): NotionPageTreeItem {
  return {
    id: pageId,
    title: plainText || pageId.slice(0, 8),
    type: "page",
  };
}

/**
 * ページIDが新規だった場合、itemsに追加
 */
function addPageIfNew(
  items: NotionPageTreeItem[],
  seenIds: Set<string>,
  pageId: string,
  plainText: string,
): void {
  if (!seenIds.has(pageId)) {
    items.push(createPageItem(pageId, plainText));
    seenIds.add(pageId);
  }
}

export function extractPageReferencesFromRichText(
  richTexts: any[],
): NotionPageTreeItem[] {
  const items: NotionPageTreeItem[] = [];
  const seenIds = new Set<string>();

  if (!Array.isArray(richTexts)) return items;

  for (const text of richTexts) {
    // Mention型をチェック
    const mentionPageId = extractPageIdFromMention(text);
    if (mentionPageId) {
      addPageIfNew(items, seenIds, mentionPageId, text.plain_text);
    }

    // href型をチェック
    if (!text.href) continue;

    const extracted = extractPageIdFromHref(text.href);
    if (extracted) {
      addPageIfNew(items, seenIds, extracted.pageId, text.plain_text);
    }
  }

  return items;
}
