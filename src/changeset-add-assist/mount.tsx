/**
 * Mounts the add assistant on the "Add" page (U4 functional-spec.md F1, BR1.3, BR1.5).
 * Uses U1's mountWithSlds (C2) to create a Shadow DOM and places exactly one widget per frame, right above the candidate table.
 * When the type cannot be read, state.ts shows a notice in the candidate area, disables Add and logs it (BR1.3).
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

/** Marker on the add-assist host element. Used to keep exactly one per frame */
export const ADD_ASSIST_HOST_ATTRIBUTE = 'data-sftoybox-add-assist';

/** Appends the add-assist CSS inside the Shadow DOM after the shared SLDS */
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
 * Places the add assistant right above the candidate table and starts loading the name, the pre-add check and the candidates.
 * If it is already mounted, returns the existing host without adding another. Does nothing outside the "Add" page.
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
