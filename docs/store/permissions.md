# 権限ごとの理由 / Permission justifications

Chrome ウェブストアへ提出するたびに、この内容を提出の「プライバシーへの取り組み」の欄に書き写します。ビルドした `manifest.json` の権限と、この文書の項目が一致していることは `npm run check:manifest` で確かめます。権限を足すときは、`scripts/check-manifest.mjs` の許可の一覧と、この文書を同時に直します。

Copy this into the "Privacy practices" section every time the extension is submitted to the Chrome Web Store. `npm run check:manifest` verifies that every permission in the built `manifest.json` is listed here. When adding a permission, update the allow list in `scripts/check-manifest.mjs` and this document together.

## 日本語

| manifest の項目              | 値                                                                                                      | 理由                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions`                | `storage`                                                                                               | ツールの ON/OFF の設定と、拡張機能の中で起きたエラーの記録（直近 20 件）を、このブラウザの中（`chrome.storage.local`）に保存するためです。同期の保存領域は使わず、外部へは送りません。          |
| `content_scripts.matches`    | `https://*.salesforce.com/*`、`https://*.force.com/*`、`https://*.salesforce-setup.com/*`               | Salesforce の設定画面に、件数の切り替えと変更セットへの追加支援を出し、ツールバーの画面からの変更セットの一覧の頼みに答えるためです。Salesforce 以外のサイトでは動きません。                    |
| `content_scripts.all_frames` | `true`                                                                                                  | Lightning Experience の設定画面は、古い形式の画面をフレームの中に表示します。そのフレームの中で画面を見分けるためです。                                                                         |
| `web_accessible_resources`   | `page-size-bar.js`、`changeset-add-assist.js`（上と同じ 3 つのドメインに限る。`use_dynamic_url: true`） | 件数バーと追加支援の部品を、ツールが ON で該当する画面のときだけ後から読み込むためです。権限ではありません。拡張機能の有無をほかのサイトから調べにくくするため、動的な URL を使います。         |
| `action`（ツールバーの画面） | `popup.html`                                                                                            | 送信変更セットの中身を一覧で見るための画面です。権限ではありません。今のタブの ID だけを使い、タブの URL や中身は読みません（`tabs` の権限は求めません）。                                      |
| `host_permissions`           | なし                                                                                                    | 求めません。変更セットの読み込みと追加は、Salesforce の画面の中から、その画面と同じ組織（同じオリジン）の Salesforce にだけ、ログイン中のセッションで行います。これには追加の権限は要りません。 |
| `content_security_policy`    | 書かない（Manifest V3 の既定）                                                                          | 外部のコードを動かさないため、既定の安全設定のままにします。                                                                                                                                    |

### データの扱い

- 利用者の Salesforce のデータを、ブラウザの外（外部のサーバーやサービス）へ送りません。通信の相手は、開いている Salesforce の画面と同じ組織だけです。
- 変更セットの中身は、画面に表示するためにブラウザのメモリの中でだけ使い、保存しません。コピーと CSV の保存は、利用者がボタンを押したときだけ行います。
- 変更セットへの追加は、利用者が選んで「追加」を押したものだけを、Salesforce の「追加」画面と同じ形で送ります。
- 保存するのは、ツールの ON/OFF と、エラーの記録（ツールの識別子・エラーの種類・時刻・文言の識別子）だけです。画面の URL やレコードの値、変更セットやコンポーネントの名前は保存しません。
- 外部から取得したコード、スタイル、フォントは使いません。すべて拡張機能の中に含めています。

## English

| Manifest field               | Value                                                                                                     | Reason                                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions`                | `storage`                                                                                                 | Stores the ON/OFF setting of each tool and a log of the most recent 20 errors inside this browser (`chrome.storage.local`). Sync storage is not used and nothing is sent outside the browser.              |
| `content_scripts.matches`    | `https://*.salesforce.com/*`, `https://*.force.com/*`, `https://*.salesforce-setup.com/*`                 | Shows the page-size switcher and the change set add assistant on Salesforce Setup pages, and answers change set list requests from the toolbar popup. The extension does not run on any other site.        |
| `content_scripts.all_frames` | `true`                                                                                                    | Lightning Experience shows classic Setup pages inside frames. The extension needs to identify the page inside those frames.                                                                                |
| `web_accessible_resources`   | `page-size-bar.js`, `changeset-add-assist.js` (only for the three domains above, `use_dynamic_url: true`) | Loads the page-size bar and the add assistant only when the tool is ON and the page matches. This is not a permission. A dynamic URL makes it harder for other sites to detect the extension.              |
| `action` (toolbar popup)     | `popup.html`                                                                                              | A screen that lists the contents of an outbound change set. This is not a permission. It uses only the current tab's ID and never reads the tab's URL or content (no `tabs` permission).                   |
| `host_permissions`           | None                                                                                                      | Not requested. Change sets are read and added from inside the Salesforce page, only to Salesforce on the same org (same origin) as that page, using the logged-in session. This needs no extra permission. |
| `content_security_policy`    | Not set (Manifest V3 default)                                                                             | No remote code is executed, so the default policy is kept.                                                                                                                                                 |

### Data handling

- Salesforce data is never sent outside the browser. The only network destination is the same org as the open Salesforce page.
- Change set contents are kept only in browser memory for display and are not stored. Copying and saving as CSV happen only when the user clicks the button.
- Only the items the user selects and adds are sent to the change set, in the same form as Salesforce's own "Add" page.
- Only the ON/OFF settings and the error log (tool identifier, error kind, time, and message identifier) are stored. Page URLs, record values, and change set or component names are not stored.
- No remote code, styles, or fonts are used. Everything is bundled in the extension.
