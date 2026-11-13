/**
 * 「追加」画面で選ばれている種類の読み取り（src/changeset/page-type.ts、BR1.3）。
 * HTML は DOMParser で読み、文書に差し込む（innerHTML は使わない）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readSelectedComponentType } from '../../src/changeset/index';

function setBody(source: string): void {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  document.body.replaceChildren(
    ...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)),
  );
}

describe('種類の読み取り（page-type）', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('種類の選択欄で選ばれている選択肢の value を読む', () => {
    setBody(`
      <form id="editPage">
        <select name="entityType">
          <option value="ApexClass">Apex Class</option>
          <option value="CustomField" selected>Custom Field</option>
        </select>
      </form>`);

    expect(readSelectedComponentType(document)).toBe('CustomField');
  });

  it('種類の選択欄がなければ null（同じ名前の select 以外の要素も数えない）', () => {
    setBody('<form id="editPage"><input name="entityType" value="ApexClass"></form>');

    expect(readSelectedComponentType(document)).toBeNull();
  });

  it('選ばれている値が空なら null', () => {
    setBody(`
      <select name="entityType">
        <option value="" selected>--None--</option>
        <option value="ApexClass">Apex Class</option>
      </select>`);

    expect(readSelectedComponentType(document)).toBeNull();
  });
});
