# 権限ごとの理由 / Permission justifications

Chrome ウェブストアへ提出するたびに、この内容を提出の「プライバシーへの取り組み」の欄に書き写します（project.md「Mandated」、team.md「Deployment」）。
ビルドした `manifest.json` の権限と、この文書の項目が一致していることは `npm run check:manifest` で確かめます。U2 以降で権限を足すときは、`scripts/check-manifest.mjs` の許可の一覧と、この文書を同時に直します。

Copy this into the "Privacy practices" section every time the extension is submitted to the Chrome Web Store. `npm run check:manifest` verifies that every permission in the built `manifest.json` is listed here.

## 日本語

| manifest の項目              | 値                                                                                        | 理由                                                                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions`                | `storage`                                                                                 | ツールの ON/OFF の設定と、拡張機能の中で起きたエラーの記録（直近 20 件）を、このブラウザの中（`chrome.storage.local`）に保存するためです。同期の保存領域は使わず、外部へは送りません。 |
| `content_scripts.matches`    | `https://*.salesforce.com/*`、`https://*.force.com/*`、`https://*.salesforce-setup.com/*` | Salesforce の設定画面の一覧に、表示件数を切り替えるボタンを出すためです。Salesforce 以外のサイトでは動きません。                                                                       |
| `content_scripts.all_frames` | `true`                                                                                    | Lightning Experience の設定画面は、古い形式の一覧画面をフレームの中に表示します。そのフレームの中で一覧を見分けるためです。                                                            |
| `web_accessible_resources`   | `page-size-bar.js`（上と同じ 3 つのドメインに限る。`use_dynamic_url: true`）              | 件数バーの部品を、ツールが ON で一覧の画面のときだけ後から読み込むためです。権限ではありません。拡張機能の有無をほかのサイトから調べにくくするため、動的な URL を使います。            |
| `host_permissions`           | なし                                                                                      | この版の拡張機能は通信をしないため、求めません。                                                                                                                                       |
| `content_security_policy`    | 書かない（Manifest V3 の既定）                                                            | 外部のコードを動かさないため、既定の安全設定のままにします。                                                                                                                           |

### データの扱い

- 利用者の Salesforce のデータを、ブラウザの外（外部のサーバーやサービス）へ送りません。
- 保存するのは、ツールの ON/OFF と、エラーの記録（ツールの識別子・エラーの種類・時刻・文言の識別子）だけです。画面の URL やレコードの値は保存しません。
- 外部から取得したコード、スタイル、フォントは使いません。すべて拡張機能の中に含めています。

## English

| Manifest field               | Value                                                                                     | Reason                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions`                | `storage`                                                                                 | Stores the ON/OFF setting of each tool and a log of the most recent 20 errors inside this browser (`chrome.storage.local`). Sync storage is not used and nothing is sent outside the browser. |
| `content_scripts.matches`    | `https://*.salesforce.com/*`, `https://*.force.com/*`, `https://*.salesforce-setup.com/*` | Shows page size buttons above Salesforce Setup list pages. The extension does not run on any other site.                                                                                      |
| `content_scripts.all_frames` | `true`                                                                                    | Lightning Experience shows classic Setup list pages inside frames. The extension needs to identify the list inside those frames.                                                              |
| `web_accessible_resources`   | `page-size-bar.js` (only for the three domains above, `use_dynamic_url: true`)            | Loads the page size bar only when the tool is ON and the page is a list page. This is not a permission. A dynamic URL makes it harder for other sites to detect the extension.                |
| `host_permissions`           | None                                                                                      | This version does not make any network requests.                                                                                                                                              |
| `content_security_policy`    | Not set (Manifest V3 default)                                                             | No remote code is executed, so the default policy is kept.                                                                                                                                    |

### Data handling

- Salesforce data is never sent outside the browser.
- Only the ON/OFF settings and the error log (tool identifier, error kind, time, and message identifier) are stored. Page URLs and record values are not stored.
- No remote code, styles, or fonts are used. Everything is bundled in the extension.
