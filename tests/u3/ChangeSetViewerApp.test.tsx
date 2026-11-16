/**
 * The toolbar popup (src/changeset-viewer/ui/ChangeSetViewerApp.tsx).
 * Page queries are answered by the chrome.tabs mock; clipboard and download are stubbed.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeSetComponents } from '../../src/changeset';
import { ChangeSetViewerApp } from '../../src/changeset-viewer/ui/ChangeSetViewerApp';
import { ViewerErrorBoundary } from '../../src/changeset-viewer/ui/ViewerErrorBoundary';
import { CHANGESET_COMPONENTS_CHANNEL, CHANGESET_PROGRESS_CHANNEL } from '../../src/page/channels';
import { PAGE_INFO_CHANNEL } from '../../src/page/page-info-responder';
import { fail, ok, type Result } from '../../src/shared/result';
import { mockState } from '../u1/helpers/chrome-mock';
import { validSettings } from '../u1/fixtures/settings';
import { emitToPopup, popupState, setTabMessageBehavior } from './helpers/chrome-popup';
import { loadComponents } from './helpers/fixtures';
import {
  installOutputSpies,
  reattachClipboard,
  restoreOutputSpies,
  type OutputSpies,
} from './helpers/output-spies';

const CHANGE_SET_ID = '0A2000000000001';
const detailInfo = {
  url: `https://example.my.salesforce.com/changemgmt/outboundChangeSetDetailPage.apexp?id=${CHANGE_SET_ID}`,
  pageKind: 'outboundChangeSetDetail',
  changeSetId: CHANGE_SET_ID,
  orgHost: 'example.my.salesforce.com',
};

function answerPageInfo(response: unknown = ok(detailInfo)) {
  setTabMessageBehavior(PAGE_INFO_CHANNEL, { kind: 'respond', response });
}

function answerComponents(response: Result<ChangeSetComponents>) {
  setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, { kind: 'respond', response });
}

function componentRequests() {
  return popupState().tabMessages.filter(
    ({ message }) => (message as { channel: string }).channel === CHANGESET_COMPONENTS_CHANNEL,
  );
}

function bodyRows() {
  return within(screen.getByTestId('viewer-table')).getAllByRole('row').slice(1);
}

let spies: OutputSpies;

async function renderLoaded(
  result: Result<ChangeSetComponents> = ok(loadComponents('components-basic')),
) {
  answerPageInfo();
  answerComponents(result);
  const user = userEvent.setup();
  reattachClipboard(spies);
  const view = render(<ChangeSetViewerApp />);
  await screen.findByTestId('viewer-count');
  return { user, ...view };
}

describe('Toolbar popup (ChangeSetViewerApp)', () => {
  beforeEach(() => {
    spies = installOutputSpies();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreOutputSpies();
  });

  it('when OFF: shows the notice and "Open settings" and never queries the page (BR1.1, NFR7.3)', async () => {
    mockState().local.settings = validSettings({ 'changeset-viewer': { enabled: false } });
    const user = userEvent.setup();
    render(<ChangeSetViewerApp />);

    expect(await screen.findByText('このツールは OFF です')).toBeInTheDocument();
    await user.click(screen.getByTestId('viewer-open-settings'));

    expect(popupState().openOptionsPageCalls).toBe(1);
    expect(popupState().tabMessages).toEqual([]);
    expect(popupState().queryInfos).toEqual([]);
  });

  it('outside the detail page shows a notice and never requests the list (BR1.2)', async () => {
    answerPageInfo(ok({ ...detailInfo, pageKind: 'pageSizeList', changeSetId: null }));
    render(<ChangeSetViewerApp />);

    expect(await screen.findByTestId('viewer-status-wrong-page')).toHaveTextContent(
      '送信変更セットの詳細画面で開いてください',
    );
    expect(componentRequests()).toEqual([]);
  });

  it('progress updates while loading ("n / m pages", or "n pages" without m) (BR1.3, NFR7.2)', async () => {
    answerPageInfo();
    setTabMessageBehavior(CHANGESET_COMPONENTS_CHANNEL, { kind: 'silent' });
    render(<ChangeSetViewerApp />);
    await waitFor(() => expect(componentRequests()).toHaveLength(1));
    expect(screen.getByRole('status')).toHaveTextContent('読み込んでいます… (0 ページ)');

    const progress = (loadedPages: number, totalPages: number | null) =>
      act(() =>
        emitToPopup({
          channel: CHANGESET_PROGRESS_CHANNEL,
          changeSetId: CHANGE_SET_ID,
          progress: { loadedPages, totalPages },
        }),
      );

    await progress(1, 3);
    expect(screen.getByRole('status')).toHaveTextContent('読み込んでいます… (1 / 3 ページ)');
    await progress(2, null);
    expect(screen.getByRole('status')).toHaveTextContent('読み込んでいます… (2 ページ)');
  });

  it('list view: name, counts, "-", initial order, focus on the filter, sorting by header (BR2.1, BR2.2, BR2.5, BR2.7)', async () => {
    const { user } = await renderLoaded();

    expect(screen.getByTestId('viewer-title')).toHaveTextContent('変更セット: TestChangeSet');
    expect(screen.getByTestId('viewer-total')).toHaveTextContent('3 件');
    expect(screen.getByTestId('viewer-count')).toHaveTextContent('表示中 3 件 / 全 3 件');
    expect(screen.getByTestId('viewer-name-filter')).toHaveFocus();
    expect(bodyRows().map((row) => row.textContent)).toEqual([
      'Apex ClassTesthelper-',
      'Apex ClassTestZebraService-',
      'Custom FieldTestField__cTestObject__c',
    ]);
    expect(screen.getByTestId('viewer-sort-type')).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByTestId('viewer-sort-api-name'));
    expect(screen.getByTestId('viewer-sort-api-name')).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByTestId('viewer-sort-type')).toHaveAttribute('aria-sort', 'none');
    screen.getByTestId('viewer-sort-api-name').focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('viewer-sort-api-name')).toHaveAttribute('aria-sort', 'descending');
    expect(bodyRows()[0]).toHaveTextContent('TestZebraService');

    await user.selectOptions(screen.getByTestId('viewer-type-filter'), 'Custom Field');
    expect(screen.getByTestId('viewer-count')).toHaveTextContent('表示中 1 件 / 全 3 件');
  });

  it('partial banner and "Try again": reloads keeping conditions, and logs (BR1.4, BR1.5, BR1.6)', async () => {
    const partial = { ...loadComponents('components-basic'), complete: false, failedPages: 1 };
    const { user } = await renderLoaded(ok(partial));

    expect(screen.getByTestId('viewer-partial')).toHaveTextContent(
      '一部のページを読み込めませんでした',
    );
    await user.type(screen.getByTestId('viewer-name-filter'), 'helper');
    expect(bodyRows()).toHaveLength(1);

    answerComponents(ok(loadComponents('components-basic')));
    await user.click(screen.getByTestId('viewer-retry'));

    await waitFor(() => expect(screen.queryByTestId('viewer-partial')).not.toBeInTheDocument());
    expect(screen.getByTestId('viewer-name-filter')).toHaveValue('helper');
    expect(bodyRows()).toHaveLength(1);
    expect(componentRequests()).toHaveLength(2);
    await waitFor(() =>
      expect(mockState().local.errorLog).toEqual([
        expect.objectContaining({
          toolId: 'changeset-viewer',
          kind: 'unexpected',
          messageKey: 'errorLog.viewerPartial',
        }),
      ]),
    );
  });

  it('output only on user action: not on open or load completion, only from the buttons (NFR1.2, BR3.8)', async () => {
    const { user } = await renderLoaded();
    expect(spies.writeText).not.toHaveBeenCalled();
    expect(spies.createObjectURL).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('viewer-copy'));
    expect(spies.writeText).toHaveBeenCalledTimes(1);
    expect(spies.writeText.mock.calls[0]?.[0]).toMatch(/^種類\tAPI 名\t親オブジェクト\r\n/);
    expect(await screen.findByText('コピーしました')).toBeInTheDocument();

    await user.click(screen.getByTestId('viewer-csv'));
    expect(spies.createObjectURL).toHaveBeenCalledTimes(1);
    expect(spies.downloads[0]).toMatch(/^TestChangeSet_\d{8}\.csv$/);
    expect(screen.getByTestId('viewer-action-notice')).toHaveTextContent('保存しました');

    spies.writeText.mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByTestId('viewer-copy'));
    expect(await screen.findByText('コピーできませんでした')).toBeInTheDocument();
    spies.createObjectURL.mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    await user.click(screen.getByTestId('viewer-csv'));
    expect(screen.getByTestId('viewer-action-notice')).toHaveTextContent('保存できませんでした');
    await waitFor(() =>
      expect(
        (mockState().local.errorLog as { messageKey: string }[]).map((e) => e.messageKey),
      ).toEqual(['errorLog.viewerSaveFailed', 'errorLog.viewerCopyFailed']),
    );
  });

  it('rendered as text: names with <script> or <img onerror> show as text and create no elements (NFR3.1)', async () => {
    const { container } = await renderLoaded(ok(loadComponents('components-unsafe-names')));

    expect(screen.getByText('Test<script>window.__pwned = true</script>')).toBeInTheDocument();
    expect(screen.getByText('Test<img src=x onerror="window.__pwned = true">')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-title')).toHaveTextContent('変更セット: Test<b>Set</b>');
    expect(container.querySelector('script, img, b')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('zero filtered rows shows the notice and "Clear filter"; output buttons are disabled (BR2.6)', async () => {
    const { user } = await renderLoaded();

    await user.type(screen.getByTestId('viewer-name-filter'), 'no-such-component');

    expect(screen.getByTestId('viewer-filtered-empty')).toHaveTextContent(
      '条件に一致するコンポーネントがありません',
    );
    expect(screen.getByTestId('viewer-copy')).toBeDisabled();
    expect(screen.getByTestId('viewer-csv')).toBeDisabled();
    expect(screen.getByTestId('viewer-count')).toHaveTextContent('表示中 0 件 / 全 3 件');

    await user.click(screen.getByTestId('viewer-clear-filter'));
    expect(screen.getByTestId('viewer-name-filter')).toHaveValue('');
    expect(screen.getByTestId('viewer-type-filter')).toHaveValue('');
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByTestId('viewer-copy')).toBeEnabled();
  });

  it('empty, error and session-expired views, and "Could not load" on a render error (BR1.4, NFR5.1)', async () => {
    const empty = { ...loadComponents('components-basic'), components: [] };
    const { unmount } = await renderLoaded(ok(empty));
    expect(screen.getByTestId('viewer-status-empty')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-copy')).toBeDisabled();
    unmount();

    answerComponents(fail('notFound', 'no receiver'));
    const first = render(<ChangeSetViewerApp />);
    expect(await screen.findByTestId('viewer-status-error')).toHaveTextContent(
      '画面を再読み込みしてから、もう一度開いてください',
    );
    first.unmount();

    answerComponents(fail('sessionExpired', 'login'));
    const second = render(<ChangeSetViewerApp />);
    expect(await screen.findByTestId('viewer-status-session-expired')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-retry')).not.toBeInTheDocument();
    second.unmount();

    const Broken = () => {
      throw new Error('render failed');
    };
    render(
      <ViewerErrorBoundary>
        <Broken />
      </ViewerErrorBoundary>,
    );
    expect(screen.getByTestId('viewer-render-error')).toHaveTextContent('読み込めませんでした');
    await waitFor(() =>
      expect((mockState().local.errorLog as { messageKey: string }[])[0]?.messageKey).toBe(
        'errorLog.viewerRenderFailed',
      ),
    );
  });
});
