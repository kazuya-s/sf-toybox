/**
 * 「追加」画面への追加支援の組み込み（U4 functional-spec.md F1、BR1.3、BR1.5）。
 * U1 の mountWithSlds（C2）で Shadow DOM を作り、候補の表のすぐ上に 1 つのフレームに 1 つだけ置く。
 * 種類を読めないときは、state.ts が候補の場所に案内を出し、追加を押せなくし、記録する（BR1.3）。
 */
import { createRoot } from 'react-dom/client';
import { findCandidateTable, readSelectedComponentType } from '../changeset/index';
import { recordError } from '../errors/error-log';
import type { PageInfo } from '../page/page-context';
import { mountWithSlds, toShadowCss } from '../page-size/mount';
import addAssistCss from './add-assist.css?inline';
import { ADD_ASSIST_TOOL_ID, createAddAssistStore } from './state';
import { AddAssistBoundary } from './ui/AddAssistBoundary';
import { AddAssistCard } from './ui/AddAssistCard';

/** 追加支援の入れ物に付ける目印。1 つのフレームに 1 つだけ置くために使う */
export const ADD_ASSIST_HOST_ATTRIBUTE = 'data-sftoybox-add-assist';

/** 共通の SLDS のあとに、追加支援の CSS を Shadow DOM の中に足す */
function addOwnStyle(host: Element, root: Element): void {
  const style = host.ownerDocument.createElement('style');
  style.textContent = toShadowCss(addAssistCss);
  root.before(style);
}

function placeHost(doc: Document): Element {
  const host = doc.createElement('div');
  host.setAttribute(ADD_ASSIST_HOST_ATTRIBUTE, '');
  host.setAttribute('data-testid', 'addassist-host');
  const table = findCandidateTable(doc);
  if (table?.parentNode) table.parentNode.insertBefore(host, table);
  else doc.body.prepend(host);
  return host;
}

/**
 * 候補の表のすぐ上に追加支援を置き、名前・追加前の確認・候補の読み込みを始める。
 * すでに置いてあれば足さずに、その入れ物を返す。「追加」画面でなければ何もしない。
 */
export function mountChangesetAddAssist(
  pageInfo: PageInfo,
  doc: Document = document,
): Element | null {
  if (pageInfo.pageKind !== 'outboundChangeSetAdd' || pageInfo.changeSetId === null) return null;
  const existing = doc.querySelector(`[${ADD_ASSIST_HOST_ATTRIBUTE}]`);
  if (existing) return existing;

  const host = placeHost(doc);
  const { root } = mountWithSlds(host);
  addOwnStyle(host, root);

  const store = createAddAssistStore({
    changeSetId: pageInfo.changeSetId,
    componentType: readSelectedComponentType(doc),
    win: doc.defaultView ?? window,
  });
  createRoot(root).render(
    <AddAssistBoundary store={store}>
      <AddAssistCard store={store} />
    </AddAssistBoundary>,
  );
  store.start().catch((error: unknown) => {
    void recordError(
      {
        toolId: ADD_ASSIST_TOOL_ID,
        kind: 'unexpected',
        messageKey: 'errorLog.addAssistMountFailed',
      },
      error,
    );
  });
  return host;
}
