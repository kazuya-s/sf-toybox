/**
 * Reading received pages (functional-design/rules.md BR1.6, security-design.md §4).
 *
 * HTML is parsed with DOMParser as a document in which scripts never run, and only textContent and
 * the chosen attributes (value, name, action, href) are returned. Document elements never leave this module.
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

/** Attributes that may be read. Restricted by the type and also checked at runtime */
const READABLE_ATTRIBUTES: ReadonlySet<string> = new Set(['value', 'name', 'action', 'href']);

/** Trims and collapses consecutive whitespace into one space */
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

/** Parses HTML. Empty or broken HTML never throws; it yields a document where nothing is found */
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
