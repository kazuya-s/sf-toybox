/**
 * Reading the type selected on the "Add" page (src/changeset/page-type.ts, BR1.3).
 * HTML is parsed with DOMParser and inserted into the document (innerHTML is not used).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readSelectedComponentType } from '../../src/changeset/index';

function setBody(source: string): void {
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  document.body.replaceChildren(
    ...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)),
  );
}

describe('Reading the type (page-type)', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('reads the value of the option selected in the type select', () => {
    setBody(`
      <form id="editPage">
        <select name="entityType">
          <option value="ApexClass">Apex Class</option>
          <option value="CustomField" selected>Custom Field</option>
        </select>
      </form>`);

    expect(readSelectedComponentType(document)).toBe('CustomField');
  });

  it('null when there is no type select (other elements with the same name do not count)', () => {
    setBody('<form id="editPage"><input name="entityType" value="ApexClass"></form>');

    expect(readSelectedComponentType(document)).toBeNull();
  });

  it('null when the selected value is empty', () => {
    setBody(`
      <select name="entityType">
        <option value="" selected>--None--</option>
        <option value="ApexClass">Apex Class</option>
      </select>`);

    expect(readSelectedComponentType(document)).toBeNull();
  });
});
