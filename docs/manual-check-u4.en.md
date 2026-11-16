# Manual checks — U4 change set add assistant

日本語版: [manual-check-u4.md](manual-check-u4.md)

After the automated tests (`npm run test -- --coverage`) and the build check (`npm run check:manifest`) pass, run the built extension by hand **in a Developer Edition org or a sandbox**.

- **Never check in a production org.** U4 is the only tool that changes Salesforce (NFR8.1).
- Record the results with the date, the org type (Developer Edition / sandbox) and the Chrome version.
- For loading the extension and the shared checks, follow "0. Prerequisites" and "1. Loading the extension" in `docs/manual-check.en.md`.

## 0. Setup

1. Create a new outbound change set for the check (name it starting with `Test`, e.g. `Test U4 check`).
2. Use an org with several Apex classes and custom fields to serve as candidates. Check with both a type that has parent objects (custom fields, etc.) and one that does not (Apex classes, etc.).
3. Check that "Change set add assistant" is ON on the options page.

## 1. Display and pre-add checks (US4.1, AC4.1.1, AC4.1.9, BR1.1-BR1.5)

1. Click "Add" on the change set detail page to open the "Add" page.
2. Check that the "sf-toybox search" card appears right above the candidate table, showing "Add to: <change set name>".
3. Check that "Loading candidates…" shows right after opening, and that candidates then appear in name order (NFR7.3).
4. Change the type in the type select and check that Salesforce reloads the page and the card is rebuilt with candidates of the new type (confirms the BR1.3 assumption).
5. Check that the developer tools (F12) "Console" shows no errors such as `Refused to load`, `Content Security Policy` or `Denying load of chrome-extension://...changeset-add-assist.js`.
6. Turn "Change set add assistant" OFF on the options page, reload the "Add" page, and check that no card appears and that `changeset-add-assist.js` is not loaded in the "Network" tab (AC4.1.9, NFR7.2). Turn it back ON afterwards.

**If the type cannot be read**: when the card shows "Could not read the component type on this page", note the HTML of the type select on the "Add" page (the `select`'s `name`) and fix `CHANGE_SET_MARKERS.add.typeSelect` in `src/salesforce/markers.ts`. If the card appears at the top of the body instead of above the table, fix `CHANGE_SET_MARKERS.add.candidateTable.table`.

## 2. Search and selection (AC4.1.2, AC4.1.3, AC4.1.6, AC4.1.8)

1. Type part of a name in mixed case and check that it filters immediately and "Matches: n" changes.
2. Check that the "Parent object" select appears for custom fields and works together with the name. Check that it does not appear for Apex classes.
3. Select two items, hide one with the search, and check that "Selected: 2 (1 hidden by the filter)" shows.
4. Enter text that matches nothing and check that "No matching components" shows; clear the search and check that the selection is kept.
5. With nothing selected, check that the Add button is disabled and "Select items to add" shows.
6. Check that pressing Enter in the search box does not start adding.

## 3. Adding (AC4.1.4, AC4.1.7, BR3.1-BR3.5)

1. Select three items and click "Add 3 selected". Check that no confirmation dialog appears and the button progresses as "Adding… (i / 3)".
2. While adding, check that search, selection and buttons are disabled and that the "Adding in progress. Leaving stops the rest…" notice shows near the button. Clicking the button repeatedly while adding must not add anything twice; confirm this later on the change set detail page.
3. When done, check that the result panel opens, focus moves to its heading, and "Added (3)" lists the three items.
4. Check that the Add button, search and selection stay disabled while the result panel is open.
5. Press Escape (or "Close") and check that the "Add" page reloads exactly once and the added items are gone from Salesforce's candidate list.
6. Open the change set detail page and check that exactly the three selected items were added.

## 4. Failure midway and the leave-page confirmation (AC4.1.5, BR3.3, BR3.6)

1. Open the "Add" page in two tabs and select candidates A, B and C in one of them.
2. In the other tab, add B to the change set first with the standard "Add".
3. In the first tab, add A, B and C. Check that it stops at B and the result panel shows "Added (A)", "Not added (B with its reason)" and "Not tried (C)". If the reason is "Could not confirm the add…", check B's state on the change set page.
4. Select many items, click Add, and try to close the tab while adding. Check that the browser's "Leave this page?" confirmation appears ("Cancel" keeps the page).
5. Check that "Recent errors" on the options page shows `changeset-add-assist` entries that contain no change set or component names.

## 5. When adding is not possible (AC4.1.10, BR1.2)

1. Open the "Add" page of an uploaded change set and check that a reason shows in red and the Add button is disabled (if Salesforce does not let you open the "Add" page, record that).
2. Log in as a test user without permission to manage change sets and check that a reason shows on the same page and the Add button is disabled.
3. Log out in another tab, click "Try again", and check that a session-expired reason shows without a "Try again" button.

## 6. Org types (AC4.1.11)

1. Check that steps 1-4 behave the same in both a Developer Edition org and a sandbox.

## 7. Clean-up

1. Check that anything added by mistake can be removed with "Remove" on the change set detail page.
2. **Delete the change set used for the check afterwards.**
