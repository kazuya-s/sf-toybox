/**
 * Shapes used inside U2 (SalesforceRequest, SalesforcePage, LoadProgress in functional-design/entities.md).
 * Exposed outside as C4/C5 Result shapes. Nothing is stored.
 */

export type HttpMethod = 'GET' | 'POST';

/** One form field (name and value) */
export type FormField = { name: string; value: string };

/** One request made through SalesforceConnection (BR1.1-BR1.3) */
export type SalesforceRequest = {
  /**
   * Destination. Without base, only an in-org path starting with / is accepted.
   * With base (a form action or a pager link), it is resolved against base.
   */
  path: string;
  method: HttpMethod;
  /** POST only. Fields read from the Add page form plus the one selected item (BR3.2) */
  formFields?: FormField[];
  /** Base for resolving path: the URL of the page the value was read from */
  base?: string;
};

/** Attributes that may be read (security-design.md §4) */
export type ReadableAttribute = 'value' | 'name' | 'action' | 'href';

/** How to read a table (defined with the markers) */
export type TableSpec = {
  table: string;
  headerCells: string;
  rows: string;
  /** Row checkbox. Only for the candidate list on the Add page */
  checkbox?: string;
};

export type TableRow = {
  /** Text of the row's td/th cells (trimmed, whitespace collapsed) */
  cells: string[];
  checkbox: FormField | null;
};

export type TableData = { headers: string[]; rows: TableRow[] };

/** How to read a form (defined with the markers) */
export type FormSpec = { form: string; submit: string };

export type PageForm = {
  /** Destination (the raw action attribute) */
  action: string;
  /** All hidden fields */
  hiddenFields: FormField[];
  /** Name and value of the "Add" button */
  submit: FormField | null;
};

export type SelectOption = { value: string; label: string; selected: boolean };

/**
 * A received page (HTML) parsed as a document in which scripts never run (BR1.6).
 * Returns only text and the chosen attribute values; document elements never leave.
 */
export interface ParsedPage {
  exists(selector: string): boolean;
  /** Text of the first matching element; null if none */
  text(selector: string): string | null;
  /** Attribute value of the first matching element; null if none */
  attribute(selector: string, attribute: ReadableAttribute): string | null;
  table(spec: TableSpec): TableData | null;
  form(spec: FormSpec): PageForm | null;
  options(selectSelector: string): SelectOption[];
}

/** A page that was read */
export type SalesforcePage = {
  redirected: false;
  status: number;
  /** URL the page was requested from; the base for resolving its links and form actions */
  url: string;
  page: ParsedPage;
};

/** Redirect response to the add POST (BR1.4; proceeds to the reload check) */
export type SalesforceRedirect = { redirected: true };

export type SalesforceResponse = SalesforcePage | SalesforceRedirect;

/** Load progress (C4 progress) */
export type LoadProgress = { loadedPages: number; totalPages: number | null };
