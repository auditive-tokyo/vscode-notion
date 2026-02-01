/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/webview/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        'vscode-fg': 'rgb(var(--vscode-editor-foreground))',
        'vscode-bg': 'rgb(var(--vscode-editor-background))',
        'vscode-border': 'rgb(var(--vscode-input-border))',
      },
      fontSize: {
        base: 'var(--vscode-font-size, 14px)',
      },
      fontFamily: {
        sans: 'var(--vscode-font-family, ui-sans-serif, system-ui)',
      },
    },
  },
  plugins: [],
}
