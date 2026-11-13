/**
 * U2 の中で使うやり取りの形（functional-design/entities.md の SalesforceRequest・SalesforcePage・LoadProgress）。
 * 外には C4・C5 の Result の形で返す。どれも保存しない。
 */

export type HttpMethod = 'GET' | 'POST';

/** フォームの 1 項目（名前と値） */
export type FormField = { name: string; value: string };

/** SalesforceConnection に頼む 1 回のやり取り（BR1.1〜BR1.3） */
export type SalesforceRequest = {
  /**
   * 送り先。base がないときは / で始まる組織の中のパスだけを受け付ける。
   * base があるとき（フォームの送り先やページ送りのリンク）は、base を基準に解く。
   */
  path: string;
  method: HttpMethod;
  /** POST のときだけ。追加画面のフォームから読み取った項目と、選んだ 1 件分（BR3.2） */
  formFields?: FormField[];
  /** path を解く基準。その値を読んだ画面の URL */
  base?: string;
};

/** 読み取ってよい属性（security-design.md §4） */
export type ReadableAttribute = 'value' | 'name' | 'action' | 'href';

/** 表の読み方（目印の定義に置く） */
export type TableSpec = {
  table: string;
  headerCells: string;
  rows: string;
  /** 行のチェック欄。追加画面の候補の一覧のときだけ */
  checkbox?: string;
};

export type TableRow = {
  /** 行の td・th の文字（前後と連続する空白を詰めたもの） */
  cells: string[];
  checkbox: FormField | null;
};

export type TableData = { headers: string[]; rows: TableRow[] };

/** フォームの読み方（目印の定義に置く） */
export type FormSpec = { form: string; submit: string };

export type PageForm = {
  /** 送り先（action 属性のそのままの値） */
  action: string;
  /** すべての隠し項目 */
  hiddenFields: FormField[];
  /** 「追加」ボタンの名前と値 */
  submit: FormField | null;
};

export type SelectOption = { value: string; label: string; selected: boolean };

/**
 * 受け取った画面（HTML）を、スクリプトを動かさない文書として読み取ったもの（BR1.6）。
 * 返すのは文字と、決めた属性の値だけで、文書の要素は外に出さない。
 */
export interface ParsedPage {
  exists(selector: string): boolean;
  /** 最初に当たった要素の文字。なければ null */
  text(selector: string): string | null;
  /** 最初に当たった要素の属性の値。なければ null */
  attribute(selector: string, attribute: ReadableAttribute): string | null;
  table(spec: TableSpec): TableData | null;
  form(spec: FormSpec): PageForm | null;
  options(selectSelector: string): SelectOption[];
}

/** 読み取れた画面 */
export type SalesforcePage = {
  redirected: false;
  status: number;
  /** その画面を頼んだ URL。画面の中のリンクやフォームの送り先を解く基準 */
  url: string;
  page: ParsedPage;
};

/** 追加の POST への転送の応答（BR1.4。読み直しへ進む） */
export type SalesforceRedirect = { redirected: true };

export type SalesforceResponse = SalesforcePage | SalesforceRedirect;

/** 読み込みの進み具合（C4 の progress） */
export type LoadProgress = { loadedPages: number; totalPages: number | null };
