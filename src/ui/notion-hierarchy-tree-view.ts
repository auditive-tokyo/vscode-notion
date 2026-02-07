import { InjectContext, Injectable, OnExtensionBootstrap } from "vedk";
import * as vscode from "vscode";
import { NotionApiClient } from "../notion-api-client";
import { NotionTreeDataProvider } from "./notion-tree-provider";
import { NotionPageTreeItem } from "../notion-api-utils/page-discovery";
import { extractPageId } from "../lib/page-id-utils";

/**
 * Notion ページツリーの TreeView 管理
 * TreeView の登録、コマンド登録、設定リスナーを一元管理
 */
@Injectable()
export class NotionHierarchyTreeView
  implements OnExtensionBootstrap, vscode.Disposable
{
  private treeDataProvider: NotionTreeDataProvider | null = null;
  private treeView: vscode.TreeView<NotionPageTreeItem> | null = null;
  private readonly disposable: vscode.Disposable;

  // 静的にアクセスするためのインスタンス
  private static instance: NotionHierarchyTreeView | null = null;

  constructor(
    @InjectContext() private readonly context: vscode.ExtensionContext,
    private readonly notionClient: NotionApiClient,
  ) {
    this.disposable = vscode.Disposable.from();
    NotionHierarchyTreeView.instance = this;
  }

  dispose() {
    this.disposable.dispose();
    NotionHierarchyTreeView.instance = null;
  }

  static getInstance(): NotionHierarchyTreeView | null {
    return NotionHierarchyTreeView.instance;
  }

  getTreeView(): vscode.TreeView<NotionPageTreeItem> | null {
    return this.treeView;
  }

  getDataProvider(): NotionTreeDataProvider | null {
    return this.treeDataProvider;
  }

  async onExtensionBootstrap() {
    await this.migrateRootPageSetting();
    await this.initializeTreeView();
    this.registerConfigListeners();
  }

  /**
   * TreeView を初期化して登録
   */
  private async initializeTreeView(): Promise<void> {
    // TreeDataProvider を初期化
    this.treeDataProvider = new NotionTreeDataProvider(
      this.notionClient,
      this.context.globalStorageUri,
    );
    await this.treeDataProvider.initialize();

    // TreeView を登録
    const treeView = vscode.window.createTreeView("notion-hierarchy", {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: true,
    });

    this.treeView = treeView;
    this.context.subscriptions.push(treeView);

    // isReady コンテキストを設定（ボタン表示用）
    vscode.commands.executeCommand("setContext", "notion:isReady", true);

    // 初期コンテキスト設定
    this.updateHierarchyContext();
  }

  /**
   * 設定変更リスナーを登録
   */
  private registerConfigListeners(): void {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration("notion.rootPage") ||
          event.affectsConfiguration("notion.rootPageId")
        ) {
          void this.migrateRootPageSetting();
          void this.treeDataProvider?.refresh();
          this.updateHierarchyContext();
        }
      }),
    );
  }

  private getRootPageInput(): string {
    const config = vscode.workspace.getConfiguration("notion");
    return (
      config.get<string>("rootPage", "") || config.get<string>("rootPageId", "")
    );
  }

  private async migrateRootPageSetting(): Promise<void> {
    const config = vscode.workspace.getConfiguration("notion");
    const rootPage = config.get<string>("rootPage", "");
    const legacyRootPageId = config.get<string>("rootPageId", "");

    if (!rootPage && legacyRootPageId) {
      await config.update("rootPage", legacyRootPageId, true);
    }
  }

  /**
   * ルートページ設定時にコンテキストを更新
   */
  private updateHierarchyContext(): void {
    const rootPageId = extractPageId(this.getRootPageInput());
    vscode.commands.executeCommand(
      "setContext",
      "notion:hierarchyEnabled",
      !!rootPageId,
    );
  }
}
