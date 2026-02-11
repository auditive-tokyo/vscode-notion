# Contributing to Notion-VSCode

Thanks for your interest in contributing! This extension is maintained by the community, and we appreciate every fix and improvement.

## What You Can Help With

- Bug fixes
- Documentation improvements
- UI/UX polish in the webview
- Notion block rendering support
- Performance improvements

## Development Setup

1. **Fork this repository** on GitHub (click the "Fork" button at the top right)
2. **Clone your fork**:

```bash
git clone https://github.com/your-username/Notion-VSCode.git
cd Notion-VSCode
git switch -c feat/my-feature  # Create your branch before making changes
npm install
```

## Run in Development

Press **F5** in VS Code to launch the Extension Development Host (watch mode starts automatically).

Alternatively, use Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) → `Debug: Start Debugging`.

## Code Quality

```bash
npm run typecheck && npm run lint
```

## Commit Convention

We use Conventional Commits:

```bash
feat(webview): add timeline view for date ranges
fix(api): handle database pagination correctly
docs(readme): update setup instructions
```

## Submitting a Pull Request

1. Make your changes and commit with [Conventional Commits](#commit-convention)
2. Push to your fork: `git push origin feat/my-feature`
3. Open a PR to `auditive-tokyo/Notion-VSCode` (this repository's `main` branch)

## Reporting Issues

Found a bug? [Open an issue](https://github.com/auditive-tokyo/Notion-VSCode/issues/new/choose) and select the **Bug Report** template.

## Documentation Translations

We welcome documentation translations! To contribute a translation:

1. Check existing translations in `docs/translations/`
2. Create an issue for your translation (e.g., "Add Japanese translation for README")
3. Create a new markdown file: `docs/translations/{filename}.{language-code}.md`
4. Translate the content from the original document (README.md, etc.)
5. Add a link to your translation in the original document
6. Submit a PR

Feel free to propose any language—no prior issue required!

## Code of Conduct

Be respectful and constructive. We welcome contributors of all experience levels.
