import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OptionsApp } from '../../../src/options/OptionsApp';
import { resolveSupportUrl } from '../../../src/options/support-url';
import { TOOL_DEFINITIONS } from '../../../src/shared/tool-ids';
import { mockState, setStorageFailure, setUiLanguage } from '../helpers/chrome-mock';
import { validSettings } from '../fixtures/settings';

const SWITCH = 'tool-toggle-page-size-switcher-switch';

async function renderOptions(supportUrl: string | null = null) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<OptionsApp supportUrl={supportUrl} />);
  await screen.findByTestId(SWITCH);
  return { user };
}

describe('Options page (OptionsApp)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('first run shows every tool ON with its name and description (AC1.1.2, AC1.1.8)', async () => {
    await renderOptions();

    expect(screen.getAllByRole('switch')).toHaveLength(TOOL_DEFINITIONS.length);
    expect(screen.getByTestId(SWITCH)).toBeChecked();
    expect(screen.getByText('一覧の表示件数の切り替え')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('sf-toybox 設定');
    expect(screen.queryByTestId('options-load-failed')).not.toBeInTheDocument();
  });

  it('toggling saves and shows "Saved" for 2 seconds (AC1.1.1, BR1.5)', async () => {
    const { user } = await renderOptions();

    await user.click(screen.getByTestId(SWITCH));

    expect(screen.getByTestId(SWITCH)).not.toBeChecked();
    await waitFor(() =>
      expect(screen.getByTestId('options-saved-notice')).toHaveTextContent('保存しました'),
    );
    // Saves use every tool's value (U3 added changeset-viewer and changeset-add-assist to the list)
    expect(mockState().local.settings).toEqual(
      validSettings({
        'page-size-switcher': { enabled: false },
        'changeset-viewer': { enabled: true },
        'changeset-add-assist': { enabled: true },
      }),
    );

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByTestId('options-saved-notice')).toHaveTextContent('');
  });

  it('a failed save reverts the toggle and shows the failure message (BR1.5)', async () => {
    const { user } = await renderOptions();
    setStorageFailure({ set: 'lastError' });

    await user.click(screen.getByTestId(SWITCH));

    expect(await screen.findByTestId('options-save-failed')).toHaveTextContent(
      '保存できませんでした。もう一度切り替えてください。',
    );
    expect(screen.getByTestId(SWITCH)).toBeChecked();
    expect(screen.getByTestId('options-saved-notice')).toHaveTextContent('');
  });

  it('when loading fails, everything is ON and a notice is shown (AC1.1.5, BR1.3)', async () => {
    mockState().local.settings = { schemaVersion: 2, tools: {} };

    await renderOptions();

    expect(await screen.findByTestId('options-load-failed')).toHaveTextContent(
      '保存した設定を読み込めませんでした。すべてのツールを ON として扱っています。',
    );
    expect(screen.getByTestId(SWITCH)).toBeChecked();
  });

  it('explains that changes apply after reloading (BR1.7)', async () => {
    await renderOptions();

    expect(screen.getByTestId('options-reload-note')).toHaveTextContent(
      '変更は Salesforce の画面を再読み込みすると反映されます。',
    );
  });

  it('support link: a link when a URL exists, otherwise "Repository coming soon" (AC1.1.6)', async () => {
    const url = 'https://github.com/example/sf-toybox/issues';
    const first = render(<OptionsApp supportUrl={url} />);
    expect(await screen.findByTestId('options-support-link')).toHaveAttribute('href', url);
    expect(screen.getByTestId('options-support-link')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    first.unmount();

    render(<OptionsApp supportUrl={resolveSupportUrl('')} />);

    expect(await screen.findByTestId('options-support-pending')).toHaveTextContent(
      '問い合わせ・不具合報告: リポジトリの準備中',
    );
    expect(resolveSupportUrl('http://example.com')).toBeNull();
    expect(resolveSupportUrl('not a url')).toBeNull();
    expect(resolveSupportUrl(url)).toBe(url);
  });

  it('lists recent errors and "Clear" removes them (security-design.md §5)', async () => {
    mockState().local.errorLog = [
      {
        toolId: 'page-size-switcher',
        kind: 'unexpected',
        at: '2026-11-12T01:02:03.000Z',
        messageKey: 'errorLog.pageSizeBarLoadFailed',
      },
      { toolId: 'core', kind: 'unexpected', at: 'not-a-date', messageKey: 'errorLog.removedKey' },
    ];
    const { user } = await renderOptions();

    const items = await screen.findAllByTestId('recent-errors-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('件数バーの部品を読み込めませんでした');
    expect(items[1]).toHaveTextContent('errorLog.removedKey');

    await user.click(screen.getByTestId('recent-errors-clear'));

    expect(await screen.findByTestId('recent-errors-empty')).toBeInTheDocument();
    expect(mockState().local.errorLog).toEqual([]);
  });

  it('shows a message when clearing fails', async () => {
    mockState().local.errorLog = [
      {
        toolId: 'core',
        kind: 'unexpected',
        at: '2026-11-12T01:02:03.000Z',
        messageKey: 'errorLog.pageDetectFailed',
      },
    ];
    const { user } = await renderOptions();
    await screen.findByTestId('recent-errors-item');
    setStorageFailure({ set: 'lastError' });

    await user.click(screen.getByTestId('recent-errors-clear'));

    expect(await screen.findByTestId('recent-errors-clear-failed')).toBeInTheDocument();
    expect(screen.getByTestId('recent-errors-item')).toBeInTheDocument();
  });

  it.each(['ja', 'en'])('no description promises speed gains (%s, AC1.1.7)', async (language) => {
    setUiLanguage(language);

    await renderOptions();

    const text = screen.getByTestId('options-app').textContent ?? '';
    expect(text).not.toMatch(/軽くな|速くな|faster|speeds? up|lighter/i);
  });
});
