# Manual checks — U1 foundation and page-size switcher

日本語版: [manual-check.md](manual-check.md)

After the automated tests (`npm run test -- --coverage`) and the build check (`npm run check:manifest`) pass, run the built extension by hand in a Developer Edition org or a sandbox. This is step 2 of the release flow.

Record the results with the date, the org type (Developer Edition / sandbox) and the Chrome version.

## 0. Prerequisites

- Chrome 120 or later
- A Salesforce Developer Edition org or sandbox where you can log in as a system administrator
- A local build: `npm ci` -> `npm run build` (output in `.output/chrome-mv3/`)

## 1. Loading the extension

1. Open `chrome://extensions` in Chrome.
2. Turn on "Developer mode" at the top right.
3. Click "Load unpacked" and choose the `.output/chrome-mv3/` folder.
4. Check that "sf-toybox" appears in the list with no errors.
5. Open "Details" and check that the permissions shown amount only to "read and change your data on the three Salesforce domains", with no mismatch against `docs/store/permissions.md`.
6. After rebuilding, click the extension's "Reload" button, then reload the Salesforce page too.

## 2. Page-size bar (US2.1)

Open a classic-style list page from Setup in Lightning Experience.

1. Open Setup -> "Apex Classes" (or another page with a pager under the list, such as "Visualforce Pages" or "Static Resources").
2. Check that the bar "Page size [100][500][1000][2000] [enter a size][Show]" appears right above the list table (AC2.1.1).
3. Click "500" and check that only that list reopens, the URL's `rowsperpage` becomes 500, and the "500" button is highlighted (AC2.1.2, AC2.1.6).
   - Check the frame URL, for example by right-clicking on the bar -> "View frame source".
4. Enter `3000` and press Enter; check that it reopens with `rowsperpage=3000` (AC2.1.3).
5. Press Enter with `0`, `-5`, `1.5`, `abc` and an empty box; check that it does not reopen, shows "Enter an integer of 1 or more", and keeps what you typed (AC2.1.4).
6. Check that other parameters (such as `setupid` or `retURL`) survive the reopen (AC2.1.5).
7. Check that nothing appears on pages without list markers (such as Setup Home) or on Lightning pages (paths starting with `/lightning/`) (AC2.1.1).
8. Check that it behaves the same in a production-like sandbox and in a Developer Edition org (AC2.1.7).

**If a list is not recognized**: when a list page shows no bar, note the shape of its pager links (class names and URLs) and fix `PAGE_MARKERS` in `src/page/page-context.ts` (BR2.3). If the bar appears at the top of the body instead of above the table, fix `PAGE_MARKERS.listTableSelectors`.

## 3. Turning a tool OFF and reloading (US1.1)

1. Open the options page from sf-toybox "Details" -> "Extension options" in `chrome://extensions`.
2. Turn "List page size switcher" OFF and check that "Saved" shows for about 2 seconds (AC1.1.1).
3. Close and reopen the options page and check that it is still OFF (AC1.1.1).
4. Reload the Apex class list and check that the bar does not appear (AC1.1.4).
5. In the developer tools (F12) "Network" tab, check that `page-size-bar.js` is not loaded (NFR7.2).
6. Turn it back ON, reload, and check that the bar appears again.
7. Check that the bottom of the options page shows the support link (until the repository URL is set it reads "Repository coming soon"; after that the link opens the GitHub Issues page; AC1.1.6).
8. Switch the browser language to English, reopen the options page, and check that it is in English (AC1.1.8).

## 4. Font and CSP errors

1. Open the developer tools on the Apex class list and look at the "Console".
2. Check that there are no errors showing that loading or rendering the bar was blocked, such as `Refused to load`, `Content Security Policy`, `net::ERR_BLOCKED_BY_CLIENT` or `Denying load of chrome-extension://...`.
   - These appear if `use_dynamic_url: true` in `web_accessible_resources` stops `page-size-bar.js` from loading. If so, record it and the author decides what to do.
3. Check that the bar's text and look (button borders, the filled selected button, the input) are not broken.
   - The bundled SLDS (2.264.x) contains no font files and uses the browser's standard font (`--slds-g-font-family-base`), so no font loading errors should appear. Record any that do.
4. In the "Network" tab, check that the bar loads nothing from outside the extension (anything other than `chrome-extension://`) (NFR3.1).

## 5. "Recent errors"

1. Check that "Recent errors" on the options page recorded no errors during the checks above.
2. If there are errors, note the time, tool ID, kind and description and investigate. Also check that they contain no URLs or Salesforce data.
3. Click "Clear" and check that the list becomes empty.

## Recording results (example)

| Date       | Org               | Chrome | 2 Bar | 3 OFF | 4 Font/CSP | 5 Recent errors | Notes |
| ---------- | ----------------- | ------ | ----- | ----- | ---------- | --------------- | ----- |
| 2026-11-xx | Developer Edition | 1xx    | OK    | OK    | OK         | OK              |       |

---

# U2 manual checks (B2) — Salesforce connection and change set loading

U2 has no UI of its own. Instead of calling U2 functions from the console, look at the real page structure and check that the markers in `src/salesforce/markers.ts` match. Once U3 and U4 exist, also check the end-to-end behavior from their screens.

**Never check in a production org** (NFR8.1). Use only a Developer Edition org or a sandbox. Use a change set created for the check with a fake name (for example `TestChangeSet`) and delete it afterwards.

Never commit the page HTML you inspect. When updating test fixtures, follow `tests/u2/fixtures/README.en.md`.

## 6. Markers on the detail and Add pages

1. Open the test change set from Setup -> "Outbound Change Sets" and add at least three kinds of components (Apex class, custom field, Visualforce page, etc.).
2. Open "Elements" in the developer tools on the detail page frame and check that the following match `CHANGE_SET_MARKERS.detail`:
   - The change set name element (`h2.pageDescription`)
   - The "Upload" button (`input[name="upload"]`); for an uploaded change set, the uploaded notice or the history table (`.uploadHistory`)
   - The component table (`.componentList table.list`), the header row (`tr.headerRow > th`) and its text (Name, Parent Object, Type), and the data rows (`tr.dataRow`)
   - The pager (`.paginator a.next[href]`) and the total count (`.paginator .totalCount`)
3. Click "Add" to open the Add page and check that the following match `CHANGE_SET_MARKERS.add`:
   - The form (`form#editPage`) and that its action is a path in the same org
   - The hidden fields (`input[type="hidden"]`) and the "Add To Change Set" button (`input[type="submit"][name="save"]`)
   - The type select (`select[name="entityType"]`), the candidate table and its checkboxes
4. Reopen with `rowsperpage` set to 200, 1000 and 2000 in the URL and note how far rows per page can go (the maximum). Set `CHANGE_SET_MARKERS.rowsPerPage` (currently 1000) to a value at or below that maximum.
5. With a change set that does not fit on one page (try a small value such as `rowsperpage=10`), check that the "Next Page" link is a path in the same org and that following it shows the next page.
6. If any marker does not match, fix only `src/salesforce/markers.ts`, update the examples in `tests/u2/fixtures/` to the same structure, and run `npm run test`.

## 7. Redirect responses (GET and the add POST)

1. Open the "Network" tab in the developer tools and turn on "Preserve log".
2. While logged in, reopen the detail and Add pages and check that both return 200, not a redirect (3xx) (an assumption of BR1.4).
3. Select one item on the Add page, click "Add To Change Set", and check that the POST response is a redirect (302 etc.). If it returns 200 and shows the Add page again, record that as is (U2 verifies by reloading either way).
4. Log out of Salesforce in another tab, reload the detail page, and check that a redirect to the login page comes back (the shape recognized as `sessionExpired`).
5. That `redirect: 'manual'` responses become `opaqueredirect` for fetch in a content script is checked from the U3 and U4 screens.

## 8. Matching labels and names

1. For each type (Apex class, custom field, Visualforce page, static resource, etc.), check that the "Name" column of candidates on the Add page and the "Name" column on the detail page after adding are written the same way (display label or API name; for fields, the "Object.Field" form).
2. Check that the type option label on the Add page (e.g. "Custom Field") matches the text in the detail page's "Type" column.
3. If a type does not match, add a per-type mapping rule to `src/salesforce/markers.ts` (BR3.3).
4. Check that items already in the change set do not appear as candidates on the Add page (an assumption of BR3.3 and BR3.5).

## 9. Chrome's DOMParser does not run scripts

1. Open the "Console" in the developer tools on a Salesforce page with the extension loaded.
2. Paste and run the following, and check that it prints `undefined` (neither the script nor onerror runs):

   ```js
   new DOMParser().parseFromString(
     '<script>window.sftoyboxCheck = 1</script><img src="x" onerror="window.sftoyboxCheck = 2">',
     'text/html',
   );
   setTimeout(() => console.log(window.sftoyboxCheck), 500);
   ```

3. In the "Network" tab, check that the `x` image is never requested (NFR3.1).

## Recording U2 results (example)

| Date       | Org               | Chrome | 6 Markers | rowsperpage max | 7 Redirects | 8 Names | 9 DOMParser | Notes |
| ---------- | ----------------- | ------ | --------- | --------------- | ----------- | ------- | ----------- | ----- |
| 2026-11-xx | Developer Edition | 1xx    | OK        | xxxx            | OK          | OK      | OK          |       |
