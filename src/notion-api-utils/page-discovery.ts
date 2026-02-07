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
export function extractPageReferencesFromRichText(
  richTexts: any[],
): NotionPageTreeItem[] {
  const items: NotionPageTreeItem[] = [];
  const seenIds = new Set<string>();

  if (!Array.isArray(richTexts)) return items;

  for (const text of richTexts) {
    if (text.type === "mention" && text.mention?.type === "page") {
      const pageId = text.mention?.page?.id;
      if (pageId && !seenIds.has(pageId)) {
        items.push({
          id: pageId,
          title: text.plain_text || pageId.slice(0, 8),
          type: "page",
        });
        seenIds.add(pageId);
      }
    }

    if (!text.href) continue;

    // Notion の内部リンク形式: /workspace/page-id や /database/page-id
    const notionLinkMatch = text.href.match(
      /\/(?:workspace|database|page)\/([a-f0-9]{32})/,
    );
    const notionDashedMatch = text.href.match(
      /\/(?:workspace|database|page)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
    );
    if (notionLinkMatch) {
      const pageId = notionLinkMatch[1];
      if (!seenIds.has(pageId)) {
        items.push({
          id: pageId,
          title: text.plain_text || pageId.slice(0, 8),
          type: "page",
        });
        seenIds.add(pageId);
      }
    }

    if (notionDashedMatch) {
      const pageId = notionDashedMatch[1];
      if (!seenIds.has(pageId)) {
        items.push({
          id: pageId,
          title: text.plain_text || pageId.slice(0, 8),
          type: "page",
        });
        seenIds.add(pageId);
      }
    }

    // 短いハイフン区切り形式も試す: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    const shortIdMatch = text.href.match(/([a-f0-9]{32})/);
    const dashedIdMatch = text.href.match(
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
    );
    if (shortIdMatch && !notionLinkMatch) {
      const pageId = shortIdMatch[1];
      if (!seenIds.has(pageId)) {
        items.push({
          id: pageId,
          title: text.plain_text || pageId.slice(0, 8),
          type: "page",
        });
        seenIds.add(pageId);
      }
    }

    if (dashedIdMatch && !notionDashedMatch) {
      const pageId = dashedIdMatch[1];
      if (!seenIds.has(pageId)) {
        items.push({
          id: pageId,
          title: text.plain_text || pageId.slice(0, 8),
          type: "page",
        });
        seenIds.add(pageId);
      }
    }
  }

  return items;
}
