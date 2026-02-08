# Contributing to Notion-VSCode

Thanks for your interest in contributing! This extension is maintained by the community, and we appreciate every fix and improvement.

## What You Can Help With

- Bug fixes
- Documentation improvements
- UI/UX polish in the webview
- Notion block rendering support
- Performance improvements

## Development Setup

```bash
git clone https://github.com/auditive-tokyo/Notion-VSCode.git
cd Notion-VSCode
npm install
npm run build
```

## Run in Development

```bash
npm run watch
```

Then press F5 in VS Code to launch the Extension Development Host.
You can also use this command if you prefer:

```bash
code --extensionDevelopmentPath=.
```

## Code Quality

```bash
npm run lint
npm run typecheck
```

## Commit Convention

We use Conventional Commits:

```bash
feat(webview): add timeline view for date ranges
fix(api): handle database pagination correctly
docs(readme): update setup instructions
```

## Submitting a Pull Request

1. Create a new branch:

```bash
git checkout -b feat/my-change
```

2. Make your changes and commit
3. Push to your fork
4. Open a PR against `main`

## Reporting Issues

Please include:

- Steps to reproduce
- Expected vs actual behavior
- VS Code version and extension version
- Screenshots if applicable

## Documentation Translations

We welcome documentation translations! To contribute a translation:

1. Check existing translations in `docs/translations/`
2. Create an issue for the translation (e.g., "Add Japanese translation for documentation")
3. Create a new markdown file: `docs/translations/{filename}.{language-code}.md`
4. Translate the content from the original document (README.md, docs/GETTING_STARTED.md, etc.)
5. Add a link to your translation issue in the original document
6. Submit a PR

For questions about which languages are needed, please check the [Issues](https://github.com/auditive-tokyo/Notion-VSCode/issues) section.

## Code of Conduct

Be respectful and constructive. We welcome contributors of all experience levels.
