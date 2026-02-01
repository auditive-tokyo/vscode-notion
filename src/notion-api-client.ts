import { Client } from '@notionhq/client'
import { NotionAPI } from 'notion-client'
import { Injectable } from 'vedk'
import * as vscode from 'vscode'

/**
 * Notion APIクライアント
 * - 公式API: プライベートページ取得、編集機能用
 * - 非公式API: 公開ページのフォールバック
 */
@Injectable()
export class NotionApiClient {
  private officialClient: Client | null = null
  private unofficialClient = new NotionAPI()

  constructor() {
    this.initializeApiKey()
  }

  /**
   * 初期化時にAPI キーを読み込む
   */
  private initializeApiKey() {
    const config = vscode.workspace.getConfiguration('notion')
    const apiKey = config.get<string>('apiKey', '')
    if (apiKey) {
      this.setApiKey(apiKey)
    }
  }

  /**
   * 公式API キーを設定
   */
  setApiKey(apiKey: string) {
    this.officialClient = new Client({ auth: apiKey })
  }

  /**
   * APIキーが設定されているか確認
   */
  isConfigured(): boolean {
    return this.officialClient !== null
  }

  /**
   * ページデータをMarkdownで取得
   * - API キーが設定されている場合は公式APIを使用
   * - 設定されていない場合は非公式APIを使用（公開ページのみ）
   */
  async getPageDataById(id: string): Promise<string> {
    console.log('[notion-api-client] getPageDataById called with id:', id)
    console.log('[notion-api-client] officialClient configured:', this.officialClient !== null)

    try {
      if (this.officialClient) {
        // 公式APIを使用してMarkdownを生成
        return await this.getPageWithOfficialApiAsMarkdown(id)
      } else {
        // 非公式APIにフォールバック（公開ページのみ）
        console.log('[notion-api-client] Using unofficial API (public pages only)')
        const recordMap = await this.unofficialClient.getPage(id)
        return this.recordMapToMarkdown(recordMap)
      }
    } catch (error) {
      console.error('[notion-api-client] getPageDataById error:', error)
      throw error
    }
  }

  /**
   * 公式APIでページを取得してMarkdownに変換
   */
  private async getPageWithOfficialApiAsMarkdown(pageId: string): Promise<string> {
    if (!this.officialClient) {
      throw new Error('Official API client is not configured')
    }

    try {
      // ページメタデータを取得
      const page = await this.officialClient.pages.retrieve({
        page_id: pageId.replace(/-/g, ''),
      })

      // ページタイトルを取得
      let title = 'Untitled'
      if ('properties' in page && page.properties && 'title' in page.properties) {
        const titleProp = page.properties['title']
        if ('title' in titleProp && Array.isArray(titleProp.title)) {
          title = titleProp.title.map((t: any) => t.plain_text).join('')
        }
      }

      // ブロックを取得してMarkdownに変換
      const blocks = await this.getPageBlocksRecursive(pageId.replace(/-/g, ''))
      const markdown = await this.blocksToMarkdown(blocks)

      return `# ${title}\n\n${markdown}`
    } catch (error) {
      throw new Error(
        `Failed to retrieve page with official API: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * ページのブロック一覧を再帰的に取得
   */
  private async getPageBlocksRecursive(pageId: string) {
    if (!this.officialClient) {
      throw new Error('Official API client is not configured')
    }

    const allBlocks: any[] = []
    let cursor: string | undefined = undefined

    try {
      while (true) {
        const params: any = {
          block_id: pageId,
          page_size: 100,
        }
        if (cursor) {
          params.start_cursor = cursor
        }
        const response = await this.officialClient.blocks.children.list(params)

        allBlocks.push(...response.results)

        if (!response.has_more) {
          break
        }
        cursor = response.next_cursor || undefined
      }

      return allBlocks
    } catch (error) {
      throw new Error(
        `Failed to retrieve blocks: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * ブロック一覧をMarkdownに変換
   */
  private async blocksToMarkdown(blocks: any[]): Promise<string> {
    let markdown = ''

    for (const block of blocks) {
      markdown += this.blockToMarkdown(block) + '\n'

      // 子ブロックがあれば再帰的に処理
      if (block.has_children) {
        try {
          const childBlocks = await this.getPageBlocksRecursive(block.id)
          const childMarkdown = await this.blocksToMarkdown(childBlocks)
          markdown += childMarkdown
        } catch (error) {
          console.warn('[notion-api-client] Failed to get child blocks:', error)
        }
      }
    }

    return markdown
  }

  /**
   * 単一ブロックをMarkdownに変換
   */
  private blockToMarkdown(block: any): string {
    const type = block.type

    try {
      switch (type) {
        case 'paragraph':
          return block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || ''

        case 'heading_1':
          return '# ' + (block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') || '')

        case 'heading_2':
          return '## ' + (block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') || '')

        case 'heading_3':
          return '### ' + (block.heading_3?.rich_text?.map((t: any) => t.plain_text).join('') || '')

        case 'bulleted_list_item':
          return '- ' + (block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '')

        case 'numbered_list_item':
          return '1. ' + (block.numbered_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '')

        case 'to_do':
          const checked = block.to_do?.checked ? '[x]' : '[ ]'
          const text = block.to_do?.rich_text?.map((t: any) => t.plain_text).join('') || ''
          return checked + ' ' + text

        case 'toggle':
          return '> ' + (block.toggle?.rich_text?.map((t: any) => t.plain_text).join('') || '')

        case 'quote':
          return '> ' + (block.quote?.rich_text?.map((t: any) => t.plain_text).join('') || '')

        case 'code':
          const language = block.code?.language || 'text'
          const code = block.code?.rich_text?.map((t: any) => t.plain_text).join('') || ''
          return `\`\`\`${language}\n${code}\n\`\`\``

        case 'divider':
          return '---'

        case 'image':
          const imageUrl = block.image?.external?.url || block.image?.file?.url || ''
          const imageCaption = block.image?.caption?.map((t: any) => t.plain_text).join('') || ''
          return `![${imageCaption}](${imageUrl})`

        case 'bookmark':
          return `[Link](${block.bookmark?.url})`

        case 'child_page':
          return `📄 ${block.child_page?.title || 'Untitled Page'}`

        case 'child_database':
          return `📊 ${block.child_database?.title || 'Untitled Database'}`

        default:
          console.warn(`[notion-api-client] Unsupported block type: ${type}`)
          return ''
      }
    } catch (error) {
      console.warn(`[notion-api-client] Error converting block of type ${type}:`, error)
      return ''
    }
  }

  /**
   * RecordMapをMarkdownに変換（非公式API用）
   */
  private recordMapToMarkdown(recordMap: any): string {
    // これは簡易実装。実際にはrecord-mapの構造を解析する必要がある
    console.log('[notion-api-client] Converting recordMap to markdown (simplified)')
    return JSON.stringify(recordMap, null, 2)
  }
}
