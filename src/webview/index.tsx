import React from 'react'
import {createRoot} from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type {CommandId} from '../constants'
import type {NotionWebviewState} from '../notion-webview-panel-serializer'
import type {OpenPageCommandArgs} from '../open-page-command'

// Assertion because we can't actually import enum into here.
const openPageCommand: `${CommandId.OpenPage}` = 'notion.openPage'

declare global {
  interface Window {
    vscode: {
      getState: () => NotionWebviewState
      setState: (state: NotionWebviewState) => void
    }
  }
}

const root = createRoot(document.getElementById('root')!)
const state = window.vscode.getState()
console.log('[webview] state received:', state)
if (!state || !state.data) {
  console.error('[webview] ERROR: No page data found in state')
  root.render(<div style={{padding: '20px', color: 'red'}}>Error: No page data available</div>)
} else {
  console.log('[webview] rendering markdown with length:', state.data.length)
  root.render(
    <div style={{padding: '20px', fontFamily: 'system-ui', lineHeight: '1.6'}}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({node, ...props}) => {
            const href = props.href || ''
            if (href.startsWith('/')) {
              const args = JSON.stringify({id: href.slice(1)} as OpenPageCommandArgs)
              return <a {...props} href={`command:${openPageCommand}?${encodeURI(args)}`}>{props.children}</a>
            }
            return <a {...props} style={{color: '#0066cc', textDecoration: 'underline'}} />
          },
          h1: ({node, ...props}) => <h1 {...props} style={{fontSize: '28px', fontWeight: 'bold', marginBottom: '16px'}} />,
          h2: ({node, ...props}) => <h2 {...props} style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '12px'}} />,
          h3: ({node, ...props}) => <h3 {...props} style={{fontSize: '20px', fontWeight: 'bold', marginBottom: '12px'}} />,
          p: ({node, ...props}) => <p {...props} style={{marginBottom: '12px'}} />,
          ul: ({node, ...props}) => <ul {...props} style={{marginLeft: '20px', marginBottom: '12px'}} />,
          ol: ({node, ...props}) => <ol {...props} style={{marginLeft: '20px', marginBottom: '12px'}} />,
          code: ({node, inline, ...props}: any) => 
            inline ? (
              <code {...props} style={{backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '3px', fontFamily: 'monospace'}} />
            ) : (
              <code {...props} style={{backgroundColor: '#f0f0f0', padding: '12px', borderRadius: '4px', fontFamily: 'monospace', display: 'block', overflow: 'auto'}} />
            ),
          blockquote: ({node, ...props}) => <blockquote {...props} style={{borderLeft: '3px solid #ccc', paddingLeft: '12px', color: '#666', fontStyle: 'italic'}} />,
          table: ({node, ...props}) => <table {...props} style={{borderCollapse: 'collapse', width: '100%', marginBottom: '16px'}} />,
          thead: ({node, ...props}) => <thead {...props} style={{backgroundColor: '#f5f5f5'}} />,
          th: ({node, ...props}) => <th {...props} style={{border: '1px solid #ddd', padding: '8px', textAlign: 'left', fontWeight: 'bold'}} />,
          td: ({node, ...props}) => <td {...props} style={{border: '1px solid #ddd', padding: '8px'}} />,
        }}
      >
        {state.data}
      </ReactMarkdown>
    </div>,
  )
}
