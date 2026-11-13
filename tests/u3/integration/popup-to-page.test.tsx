/**
 * 結合テスト: ツールバーの画面（本物の ChangeSetViewerApp と popup-client）と、
 * ページ側（本物の U1 の画面の判定への応答と U3 の受け取りの処理）を、模擬のメッセージでつなぐ。
 * U2 の listComponents だけを差し替える。
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListComponentsRequest } from '../../../src/changeset';
import { listComponents } from '../../../src/changeset';
import { registerChangesetViewerHandler } from '../../../src/changeset-viewer/request-handler';
import { ChangeSetViewerApp } from '../../../src/changeset-viewer/ui/ChangeSetViewerApp';
import { CHANGESET_COMPONENTS_CHANNEL } from '../../../src/page/channels';
import type { PageInfo } from '../../../src/page/page-context';
import { registerPageInfoResponder } from '../../../src/page/page-info-responder';
import { fail, ok } from '../../../src/shared/result';
import { mockState } from '../../u1/helpers/chrome-mock';
import { popupState } from '../helpers/chrome-popup';
import { buildManyComponents, loadComponents } from '../helpers/fixtures';
import {
  installOutputSpies,
  reattachClipboard,
  restoreOutputSpies,
  type OutputSpies,
} from '../helpers/output-spies';

vi.mock('../../../src/changeset', () => ({ listComponents: vi.fn() }));

const listComponentsMock = vi.mocked(listComponents);
const CHANGE_SET_ID = '0A2000000000001';
const detailPage: PageInfo = {
  url: `https://example.my.salesforce.com/changemgmt/outboundChangeSetDetailPage.apexp?id=${CHANGE_SET_ID}`,
  pageKind: 'outboundChangeSetDetail',
  changeSetId: CHANGE_SET_ID,
  orgHost: 'example.my.salesforce.com',
};

/** ページ側: U1 の応答と U3 の受け取りを登録する（入口と同じ順） */
async function startPageSide(): Promise<void> {
  registerPageInfoResponder(() => detailPage);
  await registerChangesetViewerHandler(detailPage);
}

function componentRequests() {
  return popupState().tabMessages.filter(
    ({ message }) => (message as { channel: string }).channel === CHANGESET_COMPONENTS_CHANNEL,
  );
}

function bodyRowTexts(): string[][] {
  return within(screen.getByTestId('viewer-table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? ''),
    );
}

async function openPopup() {
  const user = userEvent.setup();
  reattachClipboard(spies);
  render(<ChangeSetViewerApp />);
  return user;
}

let spies: OutputSpies;

describe('ツールバーの画面からページ側までの流れ', () => {
  beforeEach(async () => {
    spies = installOutputSpies();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    listComponentsMock.mockReset();
    listComponentsMock.mockImplementation(async ({ onProgress }: ListComponentsRequest) => {
      onProgress?.({ loadedPages: 1, totalPages: 1 });
      return ok(loadComponents('components-basic'));
    });
    await startPageSide();
  });

  afterEach(() => {
    restoreOutputSpies();
  });

  it('一覧が表示されるまで: 画面の判定 → 一覧の頼み → 進み具合 → 表示', async () => {
    await openPopup();

    expect(await screen.findByTestId('viewer-table')).toBeInTheDocument();
    expect(bodyRowTexts()).toHaveLength(3);
    expect(listComponentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ changeSetId: CHANGE_SET_ID }),
    );
    expect(popupState().runtimeMessages).toHaveLength(1);
    // 読み込みが終わったら、進み具合の聞き手は外れている（応答の聞き手 2 つだけが残る）
    expect(mockState().messageListeners).toHaveLength(2);
  });

  it('2 ページ目で失敗すると partial（読めた分を表示し、帯を出す）', async () => {
    listComponentsMock.mockImplementation(async ({ onProgress }: ListComponentsRequest) => {
      onProgress?.({ loadedPages: 1, totalPages: 2 });
      return ok({ ...loadComponents('components-basic'), complete: false, failedPages: 1 });
    });
    await openPopup();

    expect(await screen.findByTestId('viewer-partial')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-count')).toHaveTextContent('表示中 3 件 / 全 3 件');
  });

  it('ログイン切れで session-expired', async () => {
    listComponentsMock.mockResolvedValue(fail('sessionExpired', 'login page'));
    await openPopup();

    expect(await screen.findByTestId('viewer-status-session-expired')).toHaveTextContent(
      'Salesforce にログインし直してから、もう一度開いてください',
    );
  });

  it('読み直さない: 絞り込みと並べ替えを何度しても、ページ側への頼みは 1 回（NFR7.4）', async () => {
    listComponentsMock.mockResolvedValue(ok(buildManyComponents()));
    const user = await openPopup();
    await screen.findByTestId('viewer-table');

    await user.type(screen.getByTestId('viewer-name-filter'), 'component1');
    await user.selectOptions(screen.getByTestId('viewer-type-filter'), 'Custom Field');
    await user.click(screen.getByTestId('viewer-sort-api-name'));
    await user.click(screen.getByTestId('viewer-sort-api-name'));
    await user.click(screen.getByTestId('viewer-sort-parent'));
    await user.clear(screen.getByTestId('viewer-name-filter'));

    expect(screen.getByTestId('viewer-count')).toHaveTextContent('表示中 500 件 / 全 2000 件');
    expect(listComponentsMock).toHaveBeenCalledTimes(1);
    expect(componentRequests()).toHaveLength(1);
  });

  it('コピーの文字は、表に出ている行を表の順で出す（BR3.1）', async () => {
    const user = await openPopup();
    await screen.findByTestId('viewer-table');
    await user.click(screen.getByTestId('viewer-sort-api-name'));
    await user.click(screen.getByTestId('viewer-sort-api-name'));

    await user.click(screen.getByTestId('viewer-copy'));

    const copied = spies.writeText.mock.calls[0]?.[0] ?? '';
    const lines = copied.split('\r\n').filter((line) => line !== '');
    expect(lines[0]).toBe('種類\tAPI 名\t親オブジェクト');
    const tableAsTsv = bodyRowTexts().map((cells) =>
      cells.map((cell) => (cell === '-' ? '' : cell)).join('\t'),
    );
    expect(lines.slice(1)).toEqual(tableAsTsv);
  });

  it('失敗の記録に名前が入らない（NFR1.3）', async () => {
    listComponentsMock.mockRejectedValue(new Error('TestChangeSet / TestField__c broke'));
    await openPopup();

    expect(await screen.findByTestId('viewer-status-error')).toBeInTheDocument();
    await waitFor(() => expect(mockState().local.errorLog).toHaveLength(2));
    const log = mockState().local.errorLog as Record<string, unknown>[];
    expect(log.map((entry) => entry.messageKey)).toEqual([
      'errorLog.viewerLoadFailed',
      'errorLog.viewerHandlerFailed',
    ]);
    for (const entry of log) {
      expect(Object.keys(entry).sort()).toEqual(['at', 'kind', 'messageKey', 'toolId']);
    }
    expect(JSON.stringify(log)).not.toMatch(/TestChangeSet|TestField/);
  });
});
