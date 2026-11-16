# U2 test HTML fixtures

日本語版: [README.md](README.md)

These are example Salesforce pages used by U2's automated tests. The repository is public, so handle them as follows to keep org data out.

## Adding a fixture

1. **Never save real pages**: do not commit files made with the browser's "Save as" or copied from the developer tools. Do not keep such saved files outside the repository either.
2. **Copy only the structure**: look at the real page during the manual checks (`docs/manual-check.en.md`) and hand-write only the elements, classes, attributes and column headings the markers (`src/salesforce/markers.ts`) need.
3. **Use only fake values** from this table:

   | Item                                            | Allowed values                                                                       |
   | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
   | Host name                                       | `example.my.salesforce.com`                                                          |
   | ID                                              | All zeros after the 3-character prefix, such as `0A2000000000001`, `00N000000000001` |
   | Hidden field values                             | Values starting with `test-`, such as `test-token`, `test-viewstate`                 |
   | Names                                           | Fake names such as `TestClass`, `Test__c`, `Field_A__c`                              |
   | Email addresses, personal names, URL parameters | Never include                                                                        |

4. **Run the automated check**: run `npm run check:fixtures` and make sure it passes. CI also runs it before the tests.
5. **Have the author check by eye**: before committing, the author checks for org names, personal names and internal terms the automated check cannot catch.

## Current fixtures

| File                                    | Content                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `detail-single.html`                    | Detail page (one page, status open, a row with an empty parent object)             |
| `detail-page1.html`-`detail-page3.html` | Detail page (three pages; the last row of page 1 is repeated at the top of page 2) |
| `detail-uploaded.html`                  | Detail page (has an upload record; status uploaded)                                |
| `detail-unknown.html`                   | Detail page (no status clue, so unknown; no rows)                                  |
| `detail-missing-column.html`            | Detail page (the table's "Type" column is missing)                                 |
| `detail-after-add.html`                 | Detail page after adding (Japanese headings)                                       |
| `add-page1.html`, `add-page2.html`      | Add page (custom fields, two pages)                                                |
| `add-no-form.html`                      | Add page (no form)                                                                 |
| `login.html`                            | Login page                                                                         |
| `permission-denied.html`                | Insufficient-privileges page                                                       |
| `not-found.html`                        | Data-not-available page                                                            |
| `script.html`                           | Page with `<script>`, `onerror` and `onload`                                       |
