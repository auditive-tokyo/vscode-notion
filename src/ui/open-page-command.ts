import { parsePageId } from "notion-utils";
import { Injectable } from "vedk";
import * as vscode from "vscode";
import { CommandId } from "../constants";
import { NotionWebviewPanelSerializer } from "./notion-page-viewer";
import { NotionHierarchyTreeView } from "./notion-hierarchy-tree-view";
import { NotionPageTreeItem } from "../notion-api-utils/page-discovery";

export type OpenPageCommandArgs = {
  id?: string;
  treeItem?: NotionPageTreeItem;
};

@Injectable()
export class OpenPageCommand implements vscode.Disposable {
  private readonly disposable: vscode.Disposable;

  constructor(private readonly notionPages: NotionWebviewPanelSerializer) {
    this.disposable = vscode.commands.registerCommand(
      CommandId.OpenPage,
      this.run,
      this,
    );
  }

  dispose() {
    this.disposable.dispose();
  }

  /**
   * ツリービューで該当アイテムを展開・フォーカス
   */
  private async revealPageInTreeView(
    treeItem: NotionPageTreeItem,
  ): Promise<void> {
    const hierarchyTreeView = NotionHierarchyTreeView.getInstance();
    const treeView = hierarchyTreeView?.getTreeView();
    const dataProvider = hierarchyTreeView?.getDataProvider();

    if (!treeView || !dataProvider) return;

    try {
      const children = await dataProvider.getChildren(treeItem);
      const hasChildren = children?.length > 0;

      await treeView.reveal(treeItem, {
        focus: true,
        select: true,
        expand: hasChildren ? 1 : false,
      });
    } catch {
      // reveal に失敗した場合はログのみ（ページオープンは成功）
    }
  }

  private async run(args?: OpenPageCommandArgs) {
    let pageId = args?.id;
    const treeItemFromArgs = args?.treeItem;

    if (!pageId) {
      const urlOrId = await vscode.window.showInputBox({
        prompt: "Enter a full URL or just ID of the page.",
      });
      if (!urlOrId) return;
      pageId = parsePageId(urlOrId);
    }

    if (!pageId) {
      await vscode.window.showErrorMessage("Invalid page ID");
      return;
    }

    try {
      await this.notionPages.createOrShowPage(pageId);

      // ツリービューで該当アイテムを展開・フォーカス（treeItem が渡された場合のみ）
      if (treeItemFromArgs) {
        await this.revealPageInTreeView(treeItemFromArgs);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "An unknown error occoured while trying to open notion page.";
      await vscode.window.showErrorMessage(message);
    }
  }
}
