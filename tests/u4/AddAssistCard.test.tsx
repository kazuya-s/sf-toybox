/**
 * 追加支援の画面（src/changeset-add-assist/ui/、frontend-components.md、BR2.1〜BR2.5、BR3.4〜BR3.6、
 * NFR3.1、NFR7.3、NFR7.4）。U2 の関数は差し替え、画面は Testing Library で操作する。
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAddAssistStore, type AddAssistStore } from '../../src/changeset-add-assist/state';
import { AddAssistCard } from '../../src/changeset-add-assist/ui/AddAssistCard';
import { ok } from '../../src/shared/result';
import { TEST_CHANGE_SET_ID, TEST_COMPONENT_TYPE, candidatesFixture } from './helpers/fixtures';
import { settle } from './helpers/page';
import { watchReload } from './helpers/store';
import { u2 } from './helpers/u2-mock';

vi.mock('../../src/changeset/index', async (importOriginal) =>
  (await import('./helpers/u2-mock')).mockChangesetModule(await importOriginal()),
);
vi.mock('../../src/salesforce/index', async () =>
  (await import('./helpers/u2-mock')).mockSalesforceModule(),
);

const KEY = { amount: '00N000000000001', code: '00N000000000002', status: '00N000000000003' };

async function renderCard(): Promise<AddAssistStore> {
  const store = createAddAssistStore({
    changeSetId: TEST_CHANGE_SET_ID,
    componentType: TEST_COMPONENT_TYPE,
  });
  render(<AddAssistCard store={store} />);
  await act(async () => {
    void store.start();
  });
  await settle();
  return store;
}

const candidateNames = () =>
  within(screen.getByTestId('addassist-candidates'))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('追加支援の画面（AddAssistCard）', () => {
  beforeEach(() => {
    u2.reset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('候補を名前の順にチェック欄つきで出し、「一致」「選択中（うち非表示）」を示す。検索で U2 を呼び直さない（BR2.1、BR2.3、NFR7.4）', async () => {
    const user = userEvent.setup();
    await renderCard();

    expect(candidateNames()).toEqual([
      'TestAmount__cTestInvoice__c',
      'TestCode__c',
      'TestNote__cTestInvoice__c',
      'TestPriority__cTestOrder__c',
      'TestStatus__cTestOrder__c',
    ]);
    expect(screen.getByTestId('addassist-target')).toHaveTextContent('追加先: Test Change Set');
    expect(screen.getByTestId('addassist-match-count')).toHaveTextContent('一致: 5 件');

    await user.click(screen.getByTestId(`addassist-candidate-${KEY.amount}`));
    await user.type(screen.getByTestId('addassist-search'), 'status');
    await user.selectOptions(screen.getByTestId('addassist-parent'), 'TestOrder__c');

    expect(screen.getByTestId('addassist-match-count')).toHaveTextContent('一致: 1 件');
    expect(screen.getByTestId('addassist-selection')).toHaveTextContent(
      '選択中: 1 件（うち 1 件は絞り込みで非表示）',
    );
    expect(screen.getByTestId('addassist-add')).toHaveTextContent('選んだ 1 件を追加');
    expect(u2.listAddCandidates.calls).toHaveLength(1);
  });

  it('何も選んでいないと追加ボタンを押せず、「追加するものを選んでください」が出る（BR2.5）', async () => {
    const user = userEvent.setup();
    await renderCard();

    expect(screen.getByTestId('addassist-add')).toBeDisabled();
    expect(screen.getByTestId('addassist-select-hint')).toHaveTextContent(
      '追加するものを選んでください',
    );

    await user.click(screen.getByTestId(`addassist-candidate-${KEY.code}`));
    expect(screen.getByTestId('addassist-add')).toBeEnabled();
    expect(screen.queryByTestId('addassist-select-hint')).toBeNull();
  });

  it('一致が 0 件なら案内を出し、選択は残る（BR2.4）', async () => {
    const user = userEvent.setup();
    await renderCard();
    await user.click(screen.getByTestId(`addassist-candidate-${KEY.code}`));

    await user.type(screen.getByTestId('addassist-search'), 'no-such-component');

    expect(screen.getByTestId('addassist-no-match')).toHaveTextContent(
      '一致するコンポーネントがありません',
    );
    expect(screen.getByTestId('addassist-match-count')).toHaveTextContent('一致: 0 件');
    expect(screen.getByTestId('addassist-selection')).toHaveTextContent(
      '選択中: 1 件（うち 1 件は絞り込みで非表示）',
    );
    await user.clear(screen.getByTestId('addassist-search'));
    expect(screen.getByTestId(`addassist-candidate-${KEY.code}`)).toBeChecked();
  });

  it('文字として表示: HTML 風の名前・親オブジェクト・追加先の名前・理由が文字のまま出て、要素は作られない（NFR3.1）', async () => {
    (window as unknown as Record<string, unknown>).__sftoyboxInjected = false;
    u2.getChangeSet.next(
      ok({
        changeSetId: TEST_CHANGE_SET_ID,
        name: 'Test<img src=x onerror="window.__sftoyboxInjected = true">',
        status: 'open',
      }),
    );
    u2.listAddCandidates.next(
      ok({ candidates: candidatesFixture('html'), complete: true, failedPages: 0 }),
    );
    const user = userEvent.setup();
    const { container } = render(<div />);
    const store = await renderCard();

    await user.click(screen.getByTestId('addassist-candidate-00N000000000011'));
    u2.addComponent.nextFail('permissionDenied');
    await act(() => store.runAdd());

    const card = screen.getByTestId('addassist-card');
    expect(card).toHaveTextContent('Test<script>window.__sftoyboxInjected = true</script>');
    expect(card).toHaveTextContent('Test<img src=x onerror="window.__sftoyboxInjected = true">');
    expect(card).toHaveTextContent('Test<b>Bold</b>');
    expect(
      within(screen.getByTestId('addassist-result-failed')).getByRole('listitem'),
    ).toHaveTextContent('Test<script>');
    expect(card.querySelector('script, img, b')).toBeNull();
    expect(container.querySelector('script, img, b')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__sftoyboxInjected).toBe(false);
  });

  it('進み具合: 候補の読み込み中は「候補を読み込んでいます…」、追加中は「追加しています… (i / n)」を 1 件ごとに更新する（NFR7.3）', async () => {
    const candidates = u2.listAddCandidates.nextDeferred();
    const user = userEvent.setup();
    const store = createAddAssistStore({
      changeSetId: TEST_CHANGE_SET_ID,
      componentType: TEST_COMPONENT_TYPE,
    });
    render(<AddAssistCard store={store} />);
    await act(async () => {
      void store.start();
    });

    expect(screen.getByTestId('addassist-loading')).toHaveTextContent('候補を読み込んでいます…');
    candidates.resolve(
      ok({ candidates: candidatesFixture('basic'), complete: true, failedPages: 0 }),
    );
    await settle();
    expect(screen.queryByTestId('addassist-loading')).toBeNull();

    await user.click(screen.getByTestId(`addassist-candidate-${KEY.amount}`));
    await user.click(screen.getByTestId(`addassist-candidate-${KEY.code}`));
    const first = u2.addComponent.nextDeferred();
    const second = u2.addComponent.nextDeferred();
    await user.click(screen.getByTestId('addassist-add'));
    expect(screen.getByTestId('addassist-add')).toHaveTextContent('追加しています… (0 / 2)');

    first.resolve(ok(undefined));
    await settle();
    expect(screen.getByTestId('addassist-add')).toHaveTextContent('追加しています… (1 / 2)');
    second.resolve(ok(undefined));
    await settle();
    expect(screen.getByTestId('addassist-result')).toBeInTheDocument();
  });

  it('追加中は検索・親オブジェクト・選択・ボタンを押せず、離れるときの文言を出す（BR3.2、BR3.6）', async () => {
    const user = userEvent.setup();
    await renderCard();
    await user.click(screen.getByTestId(`addassist-candidate-${KEY.amount}`));
    const pending = u2.addComponent.nextDeferred();

    await user.click(screen.getByTestId('addassist-add'));

    expect(screen.getByTestId('addassist-add')).toBeDisabled();
    expect(screen.getByTestId('addassist-search')).toBeDisabled();
    expect(screen.getByTestId('addassist-parent')).toBeDisabled();
    expect(screen.getByTestId(`addassist-candidate-${KEY.code}`)).toBeDisabled();
    expect(screen.getByTestId('addassist-leave-warning')).toHaveTextContent(
      '送信中の 1 件は、変更セットの画面で確かめてください',
    );
    await user.click(screen.getByTestId('addassist-add'));
    pending.resolve(ok(undefined));
    await settle();
    expect(u2.addComponent.calls).toHaveLength(1);
    expect(screen.queryByTestId('addassist-leave-warning')).toBeNull();
  });

  it('結果の欄に 3 つの一覧を出し、見出しにフォーカスを移す。「閉じる」と Escape を続けても読み込み直しは 1 回（BR3.4、BR3.5、NFR3.8）', async () => {
    const reload = watchReload();
    const user = userEvent.setup();
    await renderCard();
    for (const key of [KEY.status, KEY.code, KEY.amount]) {
      await user.click(screen.getByTestId(`addassist-candidate-${key}`));
    }
    u2.addComponent.next(ok(undefined)).nextFail('unexpectedResponse');

    await user.click(screen.getByTestId('addassist-add'));
    await settle();

    const result = screen.getByTestId('addassist-result');
    expect(within(result).getByRole('heading', { level: 2 })).toHaveFocus();
    expect(within(result).getByText('追加できたもの (1)')).toBeInTheDocument();
    expect(screen.getByTestId('addassist-result-succeeded')).toHaveTextContent('TestAmount__c');
    expect(screen.getByTestId('addassist-result-failed')).toHaveTextContent(
      'TestCode__c: 追加できたか確かめられませんでした。変更セットの画面で確かめてください',
    );
    expect(screen.getByTestId('addassist-result-untried')).toHaveTextContent('TestStatus__c');
    expect(screen.getByTestId('addassist-add')).toBeDisabled();
    expect(screen.getByTestId('addassist-search')).toBeDisabled();
    expect(reload).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('addassist-result-close'));
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('検索欄で Enter を押しても追加せず、Enter での追加は追加ボタンにフォーカスがあるときだけ', async () => {
    const user = userEvent.setup();
    await renderCard();
    await user.click(screen.getByTestId(`addassist-candidate-${KEY.amount}`));

    await user.type(screen.getByTestId('addassist-search'), 'amount{Enter}');
    expect(u2.addComponent.calls).toHaveLength(0);

    screen.getByTestId('addassist-add').focus();
    await user.keyboard('{Enter}');
    await settle();
    expect(u2.addComponent.calls.map((call) => call.componentKey)).toEqual([KEY.amount]);
  });

  it('止める理由と読み込みの失敗: 赤字の理由と「もう一度試す」を出し、成功すると消える。ログイン切れではやり直しを出さない（BR1.2、BR1.4）', async () => {
    u2.checkAddPreconditions.nextFail('timeout');
    u2.getChangeSet.nextFail('timeout');
    u2.listAddCandidates.next(
      ok({ candidates: candidatesFixture('basic'), complete: false, failedPages: 1 }),
    );
    const user = userEvent.setup();
    await renderCard();

    expect(screen.getByTestId('addassist-blocked')).toHaveTextContent(
      '時間内に応答がありませんでした',
    );
    expect(screen.getAllByText(/時間内に応答がありませんでした/)).toHaveLength(1);
    expect(screen.getByTestId('addassist-load-error')).toHaveTextContent(
      '一部の候補を読み込めませんでした',
    );
    expect(screen.getByTestId('addassist-candidates')).toBeInTheDocument();

    await user.click(screen.getByTestId('addassist-retry'));
    await user.click(screen.getByTestId('addassist-retry-candidates'));
    await settle();
    expect(screen.queryByTestId('addassist-blocked')).toBeNull();
    expect(screen.queryByTestId('addassist-load-error')).toBeNull();

    // 候補の読み込みのログイン切れは、上に理由を出し、候補の場所にはやり直しを出さない
    u2.reset();
    u2.listAddCandidates.nextFail('sessionExpired');
    await renderCard();
    const blocked = screen.getAllByTestId('addassist-blocked').at(-1);
    expect(blocked).toHaveTextContent('ログイン');
    expect(blocked?.querySelector('[data-testid="addassist-retry"]')).toBeNull();
    const loadError = screen.getAllByTestId('addassist-load-error').at(-1);
    expect(loadError).toHaveTextContent('候補を読み込めませんでした');
    expect(loadError?.querySelector('[data-testid="addassist-retry-candidates"]')).toBeNull();
  });
});
