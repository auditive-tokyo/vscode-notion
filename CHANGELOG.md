# Changelog

All notable changes to Notion-VSCode will be documented in this file.

## [1.0.7] - 2026-02-11

### Fixed

- Board View now supports both `status` and `select` property types
- Status/Select property colors are now correctly extracted and displayed in Board View

## [1.0.6] - 2026-02-10

### Fixed

- Database record pages now display properties (metadata) even when content exists
- Properties are shown below the title with a separator line for better readability

## [1.0.5] - 2026-02-10

### Changed

- Optimized VSIX package size by excluding source maps and development files
- Reduced extension download size from ~17MB to ~4MB (75% reduction)

## [1.0.4] - 2026-02-09

### Added

- Support for bookmark blocks (displayed as blog-style link cards)

## [1.0.3] - 2026-02-09

### Changed

- Timeline bar labels now display dates only (time is hidden)

## [1.0.2] - 2026-02-09

### Added

- Support for `created_time` and `last_edited_time` system property types in database views

### Fixed

- Created and Last Edited columns now display correctly in database tables

## [1.0.1] - 2026-02-08

### Changed

- Updated README with credits to original author
- Added compatibility notice for original vscode-notion extension

## [1.0.0] - 2026-02-07

### 🎉 Initial Release

Complete rewrite using Official Notion API with modern TypeScript architecture, multi-view database support, accessibility compliance, and enhanced security.

See [README.md](README.md) for full feature list and documentation.
