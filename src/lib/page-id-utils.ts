/**
 * Notion ページ ID を URL または ID 文字列から抽出
 * @param input - Notion URL または 32 文字の ID
 * @returns 抽出された ID、または null（無効な形式）
 * @example
 * extractPageId("https://www.notion.so/MyPage-abc123...-abcdef012345") // "abc123...abcdef012345"
 * extractPageId("https://www.notion.so/2f9b9a687adc80ce8d43e8af08803c85?v=...") // "2f9b9a687adc80ce8d43e8af08803c85"
 * extractPageId("abc123def456...") // "abc123def456..."
 */
export function extractPageId(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();

  // 既に 32 文字の ID の可能性（ハイフン無し）
  if (/^[a-f0-9]{32}$/.test(trimmed)) {
    return trimmed;
  }

  // ハイフン付き ID の可能性（8-4-4-4-12）
  if (
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      trimmed,
    )
  ) {
    return trimmed.replace(/-/g, "");
  }

  // URL の可能性
  try {
    const url = new URL(trimmed);

    // notion.so ドメイン確認
    if (!url.hostname.includes("notion.so")) {
      return null;
    }

    // パス部分から ID を抽出
    // 形式1: /PageName-{ID} （通常ページ）
    // 形式2: /{ID} （DB ページ）
    const pathParts = url.pathname.split("/").filter((p) => p.length > 0);
    for (const part of pathParts) {
      // ハイフン区切りの最後の部分が 32 文字 ID の場合
      const segments = part.split("-");
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && /^[a-f0-9]{32}$/.test(lastSegment)) {
        return lastSegment;
      }
      // または、部分全体が 32 文字 ID の場合
      if (/^[a-f0-9]{32}$/.test(part)) {
        return part;
      }
    }

    // hash 部分から抽出（URL のハッシュの場合）
    const hashMatch = url.hash.match(/([a-f0-9]{32})/);
    if (hashMatch && hashMatch[1]) {
      return hashMatch[1];
    }

    return null;
  } catch {
    // URL パース失敗 → 無効な入力
    return null;
  }
}

/**
 * 入力が有効な Notion ID/URL かチェック
 */
export function isValidNotionInput(input: string): boolean {
  return extractPageId(input) !== null;
}
