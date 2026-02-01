import 'reflect-metadata/lite'
import {Extension} from 'vedk'
import * as vscode from 'vscode'

import {NotionApiClient} from './notion-api-client'
import {NotionWebviewPanelSerializer} from './notion-webview-panel-serializer'
import {OpenPageCommand} from './open-page-command'
import {RecentsStateProvider, RecentsTreeDataProvider, RecentsTreeView} from './recents'

const extension = new Extension({
  entries: [
    NotionApiClient,
    NotionWebviewPanelSerializer,
    OpenPageCommand,
    // Recents
    RecentsStateProvider,
    RecentsTreeDataProvider,
    RecentsTreeView,
  ],
})

export async function activate(context: vscode.ExtensionContext) {
  // API キー読み込みログ
  const config = vscode.workspace.getConfiguration('notion')
  const apiKey = config.get<string>('apiKey', '')
  console.log('[notion-extension] ✓ API Key loaded:', apiKey ? '***' + apiKey.slice(-8) : 'NOT SET')

  await extension.activate(context)

  // 設定変更をリッスン
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('notion.apiKey')) {
      // 動的にAPI キーを更新
      const config = vscode.workspace.getConfiguration('notion')
      const newApiKey = config.get<string>('apiKey', '')
      console.log('[notion-extension] ✓ API Key updated:', newApiKey ? '***' + newApiKey.slice(-8) : 'NOT SET')
      // NotionApiClientはコンストラクタで自動初期化されるため追加処理は不要
    }
  }, null, context.subscriptions)
}
