# Manual checks — U3 change set contents viewer

日本語版: [manual-check-u3.md](manual-check-u3.md)

Steps to check by hand in a Developer Edition org or a sandbox before release. **Never check in a production org.**

## Setup

1. Run `npm ci` and `npm run build`.
2. In Chrome's `chrome://extensions`, turn on "Developer mode" and load `.output/chrome-mv3` with "Load unpacked".
3. Prepare an outbound change set with a few components in a Developer Edition org or sandbox. Also prepare one that does not fit on one page (many components) to check the progress display.
4. In the extension details, check that the only permission requested is "Storage", with no `tabs`, `downloads` or `clipboardWrite`.

## What to check

| #   | Action                                                                                    | Expected                                                                                                                     | Result |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | On an outbound change set detail page, click the toolbar icon                             | "Loading… (n / m pages)" shows, then the list. The header shows "Change set: <name>" and "m items". The filter box has focus |        |
| 2   | Look at the initial order                                                                 | By type, then API name (case-insensitive). Rows without a parent object show "-"                                             |        |
| 3   | Filter by name, pick a type, click column headers (also with Enter)                       | Rows are filtered and "Showing n of m" changes. Clicking the same header twice sorts descending                              |        |
| 4   | Enter a name that matches nothing                                                         | "No components match the filter" and "Clear filter" show, and Copy and CSV are disabled. "Clear filter" restores the list    |        |
| 5   | Click "Copy list" and paste into a spreadsheet (Excel etc.)                               | Row 1 is the header and rows paste in table order. Names starting with `=` or `+` never run as formulas                      |        |
| 6   | Click "Save as CSV" and open the CSV in Excel                                             | The file name is "<change set name>_<YYYYMMDD>.csv". Japanese text is not garbled                                            |        |
| 7   | Click the icon on a page that is not an outbound change set detail page (e.g. Setup Home) | "Open this on an outbound change set detail page"                                                                            |        |
| 8   | Turn "Change set contents" OFF on the options page and click the icon on a detail page    | "This tool is turned off" and "Open settings". "Open settings" opens the options page                                        |        |
| 9   | Log out while the detail page is open, then click the icon                                | "Log in to Salesforce again, then reopen this"                                                                               |        |
| 10  | Switch the tool from OFF back to ON and click the icon without reloading the detail page  | "Could not load" and "Reload the page, then open this again". After reloading, the list shows                                |        |
| 11  | Look at "Recent errors" on the options page                                               | Failure entries contain no change set or component names                                                                     |        |

## Recording

- Write the date, the org type (Developer Edition or sandbox) and the Chrome version.
- If anything differs from the expectation, review the page markers (`src/page/page-context.ts`, `src/salesforce/markers.ts`).
