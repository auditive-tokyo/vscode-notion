import { Client } from '@notionhq/client'
import { NotionAPI } from 'notion-client'
import { Injectable } from 'vedk'

@Injectable()
export class NotionApiClient {
  private officialClient: Client | null = null
  private unofficialClient = new NotionAPI()

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
   * ページデータを取得
   * - API キーが設定されている場合は公式APIを使用
   * - 設定されていない場合は非公式APIを使用（公開ページのみ）
   */
  async getPageDataById(id: string) {
    if (this.officialClient) {
      // 公式APIを使用
      return await this.getPageWithOfficialApi(id)
    } else {
      // 非公式APIにフォールバック（公開ページのみ）
      return this.unofficialClient.getPage(id)
    }
  }

  /**
   * 公式APIでページを取得
   */
  private async getPageWithOfficialApi(pageId: string) {
    if (!this.officialClient) {
      throw new Error('Official API client is not configured')
    }

    try {
      const page = await this.officialClient.pages.retrieve({
        page_id: pageId.replace(/-/g, ''),
      })
      return page
    } catch (error) {
      throw new Error(
        `Failed to retrieve page with official API: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * ページのブロック一覧を取得（公式API）
   */
  async getPageBlocks(pageId: string) {
    if (!this.officialClient) {
      throw new Error('Notion API is not configured. Please set your API key.')
    }

    try {
      const blocks = await this.officialClient.blocks.children.list({
        block_id: pageId.replace(/-/g, ''),
      })
      return blocks.results
    } catch (error) {
      throw new Error(
        `Failed to retrieve blocks: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
