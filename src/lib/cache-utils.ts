import * as vscode from "vscode";

/**
 * キャッシュTTLをミリ秒で取得（VS Code設定から読み込み）
 * @returns TTLをミリ秒で返す。設定値が0の場合は0を返す（無効化）
 */
export function getCacheTtlMs(): number {
  const ttlDays =
    vscode.workspace.getConfiguration("notion").get<number>("cacheTtlDays") ??
    7;
  return ttlDays * 24 * 60 * 60 * 1000;
}
