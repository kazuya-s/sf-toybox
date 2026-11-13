/**
 * 今の「追加」画面で選ばれている種類の値を読む（U4 functional-design/rules.md の BR1.3）。
 * 目印は src/salesforce/markers.ts の CHANGE_SET_MARKERS.add.typeSelect の 1 か所だけを使う。
 * 通信はせず、そのフレームの文書の選択欄の value を読むだけにする。
 */
import { CHANGE_SET_MARKERS } from '../salesforce/markers';

/** 「追加」画面の候補の表。追加支援はこの表のすぐ上に置く（U4 BR1.5）。なければ null */
export function findCandidateTable(doc: Document): Element | null {
  return doc.querySelector(CHANGE_SET_MARKERS.add.candidateTable.table);
}

/** 種類の選択欄のいまの値。選択欄がない・値が空のときは null */
export function readSelectedComponentType(doc: Document): string | null {
  const select = doc.querySelector<HTMLSelectElement>(CHANGE_SET_MARKERS.add.typeSelect);
  if (select?.tagName !== 'SELECT') return null;
  const value = select.value.trim();
  return value === '' ? null : value;
}
