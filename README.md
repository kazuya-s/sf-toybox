# sf-toybox

日本語: [README.ja.md](README.ja.md)

A Chrome extension of small tools that make Salesforce Setup pages a little handier. Each tool can be turned ON or OFF on the options page; every tool is ON by default.

## Tools

| Tool                     | Where it works                                                         | What it does                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List page size switcher  | Classic-style Setup list pages (Apex Classes, Visualforce Pages, etc.) | Adds a bar above the list to switch rows per page (100 / 500 / 1000 / 2000, or any number)                                                                                    |
| Change set contents      | Toolbar popup on an outbound change set detail page                    | Lists every component of the change set on one screen, across all pages. Filter, sort, copy as tab-separated text or save as CSV (UTF-8 with BOM)                             |
| Change set add assistant | The "Add" page of an outbound change set                               | Search candidates by name or parent object, select several, and add them one by one. Stops at the first failure and shows what was added, what failed, and what was not tried |

The UI follows the browser language (Japanese or English).

## Privacy

- Salesforce data never leaves the browser. The only network destination is the same Salesforce org as the page you have open, using your logged-in session.
- The only stored data is each tool's ON/OFF setting and a short error log (tool ID, error kind, time, message ID) in `chrome.storage.local`. No URLs, record values, or change set or component names are stored.
- No remote code, styles, or fonts are loaded. Everything is bundled in the extension.
- The only permission requested is `storage`. See [docs/store/permissions.md](docs/store/permissions.md) for the reason behind each manifest entry.

## Requirements

- Chrome 120 or later
- Salesforce with Setup access. The change set tools need permission to manage change sets.

## Installing from source

The extension is not yet on the Chrome Web Store. To try it from source:

```bash
npm ci
npm run build
```

1. Open `chrome://extensions` and turn on "Developer mode".
2. Click "Load unpacked" and choose `.output/chrome-mv3/`.
3. Open the options from the extension's "Details" -> "Extension options" to turn tools ON or OFF.

Changes to the settings apply after reloading the Salesforce page.

> Try the change set add assistant in a Developer Edition org or a sandbox first. It is the only tool that changes your org.

## Development

Requires Node.js 22.

| Command                      | What it does                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `npm run lint`               | ESLint, Prettier check and TypeScript type check                                 |
| `npm run build`              | Builds the extension into `.output/chrome-mv3/` with WXT                         |
| `npm run test -- --coverage` | Runs the Vitest tests with coverage (fails below 80% line coverage)              |
| `npm run check:manifest`     | Checks the built manifest: permissions, matches, bundled files, no external URLs |
| `npm run check:fixtures`     | Checks that test fixtures contain no real org data                               |
| `npm run zip`                | Builds the zip for the Chrome Web Store                                          |

CI (GitHub Actions) runs all of the above on pushes and pull requests to `develop` and `main`.

Tests run in Node with happy-dom and never connect to a real org. Some behavior can only be checked in a real browser and org; see the manual check guides:

- [docs/manual-check.en.md](docs/manual-check.en.md) — foundation, page-size switcher, Salesforce connection
- [docs/manual-check-u3.en.md](docs/manual-check-u3.en.md) — change set contents
- [docs/manual-check-u4.en.md](docs/manual-check-u4.en.md) — change set add assistant

Never run manual checks in a production org.

### Project layout

| Path                                                        | Contents                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `entrypoints/`                                              | Extension entry points: content script, options page, toolbar popup, lazily loaded widgets |
| `src/settings/`, `src/storage/`, `src/errors/`, `src/i18n/` | Tool ON/OFF, local storage, error log, messages                                            |
| `src/page/`                                                 | Page detection and in-extension message channels                                           |
| `src/page-size/`                                            | List page size switcher                                                                    |
| `src/salesforce/`, `src/changeset/`                         | Same-origin connection to Salesforce and change set reading/adding                         |
| `src/changeset-viewer/`                                     | Change set contents (toolbar popup)                                                        |
| `src/changeset-add-assist/`                                 | Change set add assistant                                                                   |
| `public/_locales/`                                          | Japanese and English UI messages                                                           |
| `scripts/`                                                  | Build and fixture check scripts                                                            |
| `tests/`                                                    | Unit and integration tests                                                                 |

Page structure markers for reading Salesforce pages live in one place: `src/salesforce/markers.ts` (and `PAGE_MARKERS` in `src/page/page-context.ts`). If Salesforce changes its pages, fix them there.

### Branches

Daily work goes to `develop`. Releases are merged from `develop` into `main`.

## Reporting a problem

Open an issue using the bug report template. Copy the "Recent errors" list from the options page into the issue. Please do not include your org name, URLs, or record data.

## License

[MIT](LICENSE)
