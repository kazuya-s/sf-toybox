/**
 * 受け取った画面の読み取り（functional-design/rules.md の BR1.6、security-design.md §4）。
 *
 * HTML は DOMParser でスクリプトが動かない文書として読み、textContent と
 * 決めた属性（value・name・action・href）の文字だけを返す。文書の要素は外に出さない。
 */
import type {
  FormField,
  FormSpec,
  PageForm,
  ParsedPage,
  ReadableAttribute,
  SelectOption,
  TableData,
  TableSpec,
} from './types';

/** 読み取ってよい属性。型で縛るのに加え、実行時にもこれ以外は読まない */
const READABLE_ATTRIBUTES: ReadonlySet<string> = new Set(['value', 'name', 'action', 'href']);

/** 前後の空白を除き、続く空白を 1 つに詰める */
function cleanText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function fieldOf(element: Element | null): FormField | null {
  const name = element?.getAttribute('name');
  if (!element || !name) return null;
  return { name, value: element.getAttribute('value') ?? '' };
}

function cellsOf(row: Element): string[] {
  return Array.from(row.children)
    .filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH')
    .map((cell) => cleanText(cell.textContent));
}

function readTable(doc: Document, spec: TableSpec): TableData | null {
  const table = doc.querySelector(spec.table);
  if (!table) return null;
  const headers = Array.from(table.querySelectorAll(spec.headerCells)).map((cell) =>
    cleanText(cell.textContent),
  );
  const rows = Array.from(table.querySelectorAll(spec.rows)).map((row) => ({
    cells: cellsOf(row),
    checkbox: spec.checkbox ? fieldOf(row.querySelector(spec.checkbox)) : null,
  }));
  return { headers, rows };
}

function readForm(doc: Document, spec: FormSpec): PageForm | null {
  const form = doc.querySelector(spec.form);
  if (!form) return null;
  const hiddenFields = Array.from(form.querySelectorAll('input[type="hidden"]'))
    .map(fieldOf)
    .filter((field): field is FormField => field !== null);
  return {
    action: form.getAttribute('action') ?? '',
    hiddenFields,
    submit: fieldOf(form.querySelector(spec.submit)),
  };
}

function readOptions(doc: Document, selectSelector: string): SelectOption[] {
  return Array.from(doc.querySelectorAll(`${selectSelector} option`)).map((option) => {
    const label = cleanText(option.textContent);
    return {
      value: option.getAttribute('value') ?? label,
      label,
      selected: option.hasAttribute('selected'),
    };
  });
}

/** HTML を読み取る。空や壊れた HTML でも例外は出さず、何も見つからない文書になる */
export function parsePage(html: string): ParsedPage {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return {
    exists: (selector) => doc.querySelector(selector) !== null,
    text: (selector) => {
      const element = doc.querySelector(selector);
      return element ? cleanText(element.textContent) : null;
    },
    attribute: (selector, attribute: ReadableAttribute) => {
      if (!READABLE_ATTRIBUTES.has(attribute)) return null;
      return doc.querySelector(selector)?.getAttribute(attribute) ?? null;
    },
    table: (spec) => readTable(doc, spec),
    form: (spec) => readForm(doc, spec),
    options: (selectSelector) => readOptions(doc, selectSelector),
  };
}
