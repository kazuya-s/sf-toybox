import { describe, expect, it } from 'vitest';
import { CHANGE_SET_MARKERS } from '../../../src/salesforce/markers';
import { parsePage } from '../../../src/salesforce/parse';
import type { ReadableAttribute } from '../../../src/salesforce/types';
import { readFixture } from '../helpers/location';

type ScriptFlagWindow = { sftoyboxScriptRan?: boolean };

function waitForTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

describe('画面の読み取り（parse、BR1.6、NFR3.1）', () => {
  it('詳細画面の例から、名前・行・ページ送りが読める', () => {
    const page = parsePage(readFixture('detail-page1.html'));

    const table = page.table(CHANGE_SET_MARKERS.detail.componentTable);

    expect(page.text(CHANGE_SET_MARKERS.detail.name)).toBe('TestChangeSet');
    expect(table?.headers).toEqual(['Action', 'Name', 'Parent Object', 'Type']);
    expect(table?.rows.map((row) => row.cells)).toEqual([
      ['Remove', 'TestClassA', '', 'Apex Class'],
      ['Remove', 'Field_A__c', 'Test__c', 'Custom Field'],
    ]);
    expect(page.attribute(CHANGE_SET_MARKERS.paging.next, 'href')).toBe(
      '/changemgmt/outboundChangeSetDetailPage.apexp?id=0A2000000000001&rowsperpage=1000&lsr=2',
    );
    expect(page.text(CHANGE_SET_MARKERS.paging.totalCount)).toBe('5');
  });

  it('<script>・onerror・onload を含む HTML を読んでも、何も実行されない', async () => {
    const flagWindow = window as unknown as ScriptFlagWindow;
    delete flagWindow.sftoyboxScriptRan;

    const page = parsePage(readFixture('script.html'));
    await waitForTasks();

    expect(page.text(CHANGE_SET_MARKERS.detail.name)).toBe('TestScriptSet');
    expect(flagWindow.sftoyboxScriptRan).toBeUndefined();
  });

  it('読んだ文書の要素は利用者の画面に入らず、返すのは文字と単純な値だけ', () => {
    const before = document.body.childElementCount;

    const page = parsePage(readFixture('add-page1.html'));
    const form = page.form(CHANGE_SET_MARKERS.add.formSpec);
    const table = page.table(CHANGE_SET_MARKERS.add.candidateTable);

    expect(document.body.childElementCount).toBe(before);
    expect(document.querySelector('form#editPage')).toBeNull();
    expect(form).toEqual({
      action: '/p/mfpkg/AddToPackageFromChangeMgmtUi',
      hiddenFields: [
        { name: 'id', value: 'test-changeset' },
        { name: '_CONFIRMATIONTOKEN', value: 'test-token' },
        { name: 'viewState', value: 'test-viewstate' },
      ],
      submit: { name: 'save', value: '変更セットに追加' },
    });
    expect(table?.rows[0]?.checkbox).toEqual({ name: 'ids', value: '00N000000000001' });
    expect(JSON.parse(JSON.stringify(form))).toEqual(form);
    expect(page.options(CHANGE_SET_MARKERS.add.typeSelect)).toEqual([
      { value: 'ApexClass', label: 'Apex クラス', selected: false },
      { value: 'CustomField', label: 'カスタム項目', selected: true },
    ]);
  });

  it('決めた属性（value・name・action・href）以外は返さない', () => {
    const page = parsePage(readFixture('script.html'));

    expect(page.attribute('a.next', 'href')).toBe('javascript:void(0)');
    expect(page.attribute('a.next', 'data-secret' as ReadableAttribute)).toBeNull();
    expect(page.attribute('img', 'onerror' as ReadableAttribute)).toBeNull();
    expect(page.attribute('.missing', 'href')).toBeNull();
  });

  it('空の HTML や壊れた HTML でも例外が出ず、何も見つからない', () => {
    for (const html of ['', '<table><tr><td>', '<<<>>>', '<form id="editPage"><input']) {
      const page = parsePage(html);
      expect(page.text(CHANGE_SET_MARKERS.detail.name)).toBeNull();
      expect(page.table(CHANGE_SET_MARKERS.detail.componentTable)).toBeNull();
      expect(page.options(CHANGE_SET_MARKERS.add.typeSelect)).toEqual([]);
    }
    const partial = parsePage('<form id="editPage"><input type="hidden" value="x">');
    expect(partial.form(CHANGE_SET_MARKERS.add.formSpec)).toEqual({
      action: '',
      hiddenFields: [],
      submit: null,
    });
  });
});
