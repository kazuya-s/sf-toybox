/**
 * 「追加」画面への組み込み（src/changeset-add-assist/mount.tsx、BR1.3、BR1.5、security-design.md §6、NFR5.1）。
 */
import { act, fireEvent, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADD_ASSIST_HOST_ATTRIBUTE,
  mountChangesetAddAssist,
} from '../../src/changeset-add-assist/mount';
import type { AddAssistCardProps } from '../../src/changeset-add-assist/ui/AddAssistCard';
import type { PageInfo } from '../../src/page/page-context';
import { ok } from '../../src/shared/result';
import { mockState } from '../u1/helpers/chrome-mock';
import { TEST_CHANGE_SET_ID, TEST_ORG_HOST } from './helpers/fixtures';
import { ADD_PAGE_URL, addPageHtml, addPageWithoutTypeHtml, setBody, settle } from './helpers/page';
import { watchBeforeUnload } from './helpers/store';
import { u2 } from './helpers/u2-mock';

vi.mock('../../src/changeset/index', async (importOriginal) =>
  (await import('./helpers/u2-mock')).mockChangesetModule(await importOriginal()),
);
vi.mock('../../src/salesforce/index', async () =>
  (await import('./helpers/u2-mock')).mockSalesforceModule(),
);

/** 描画エラーを起こす条件: always はいつでも、adding は追加中になったとき */
const failRender = vi.hoisted(() => ({ when: 'never' as 'never' | 'always' | 'adding' }));

vi.mock('../../src/changeset-add-assist/ui/AddAssistCard', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/changeset-add-assist/ui/AddAssistCard')>();
  return {
    AddAssistCard: (props: AddAssistCardProps) => {
      const phase = useSyncExternalStore(props.store.subscribe, () => props.store.getState().phase);
      if (failRender.when === 'always' || (failRender.when === 'adding' && phase === 'adding')) {
        throw new Error('render failed');
      }
      return <original.AddAssistCard {...props} />;
    },
  };
});

const addPage: PageInfo = {
  url: ADD_PAGE_URL,
  pageKind: 'outboundChangeSetAdd',
  changeSetId: TEST_CHANGE_SET_ID,
  orgHost: TEST_ORG_HOST,
};

async function mount(info: PageInfo = addPage): Promise<Element | null> {
  let host: Element | null = null;
  await act(async () => {
    host = mountChangesetAddAssist(info);
  });
  await settle();
  return host;
}

function inShadow(host: Element | null) {
  const shadow = host?.shadowRoot;
  if (!shadow) throw new Error('shadow root がありません');
  return within(shadow as unknown as HTMLElement);
}

function errorLogKeys(): unknown[] {
  const log = (mockState().local.errorLog as { messageKey: string }[] | undefined) ?? [];
  return log.map((entry) => entry.messageKey);
}

describe('「追加」画面への組み込み（mount）', () => {
  beforeEach(() => {
    u2.reset();
    failRender.when = 'never';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('Shadow DOM の中で、候補の表のすぐ上に置き、名前・確認・候補の読み込みを始める（BR1.5）', async () => {
    setBody(addPageHtml());

    const host = await mount();

    expect(host?.nextElementSibling).toBe(document.querySelector('form#editPage table.list'));
    expect(host?.shadowRoot?.querySelectorAll('style')).toHaveLength(2);
    expect(inShadow(host).getByTestId('addassist-card')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="addassist-card"]')).toBeNull();
    expect(u2.listAddCandidates.calls).toEqual([
      { changeSetId: TEST_CHANGE_SET_ID, componentType: 'CustomField' },
    ]);
  });

  it('2 回呼んでも 1 つだけで、「追加」画面でなければ何もしない', async () => {
    setBody(addPageHtml());

    const first = await mount();
    const second = await mount();

    expect(second).toBe(first);
    expect(document.querySelectorAll(`[${ADD_ASSIST_HOST_ATTRIBUTE}]`)).toHaveLength(1);
    expect(u2.getChangeSet.calls).toHaveLength(1);
    expect(await mount({ ...addPage, pageKind: 'outboundChangeSetDetail' })).toBeNull();
    document.body.replaceChildren();
    expect(await mount({ ...addPage, pageKind: 'pageSizeList', changeSetId: null })).toBeNull();
    expect(await mount({ ...addPage, changeSetId: null })).toBeNull();
  });

  it('種類を読めないときは、候補の場所に案内を出し、追加を押せなくし、記録する（BR1.3）', async () => {
    setBody(addPageWithoutTypeHtml);

    const host = await mount();

    const shadow = inShadow(host);
    expect(shadow.getByTestId('addassist-type-unreadable')).toHaveTextContent(
      'この画面の種類を読み取れませんでした',
    );
    expect(shadow.getByTestId('addassist-add')).toBeDisabled();
    expect(u2.listAddCandidates.calls).toHaveLength(0);
    await vi.waitFor(() => expect(errorLogKeys()).toContain('errorLog.addAssistTypeUnreadable'));
  });

  it('描画エラーでは追加支援だけを外し、Salesforce の画面は壊さずに記録する（NFR5.1）', async () => {
    failRender.when = 'always';
    setBody(addPageHtml());

    const host = await mount();

    expect(host?.shadowRoot?.querySelector('[data-testid="addassist-card"]')).toBeNull();
    expect(host?.shadowRoot?.querySelector('[data-testid="addassist-aborted"]')).toBeNull();
    expect(document.querySelector('form#editPage table.list')).not.toBeNull();
    expect(document.querySelector('select[name="entityType"]')).not.toBeNull();
    await vi.waitFor(() => expect(errorLogKeys()).toContain('errorLog.addAssistRenderFailed'));
  });

  it('追加中に描画エラーが起きると、今の 1 件のあとで止まり、beforeunload はループが終わるまで残る（security-design.md §6）', async () => {
    const watch = watchBeforeUnload();
    setBody(addPageHtml());
    const host = await mount();
    const shadow = inShadow(host);
    fireEvent.click(shadow.getByTestId('addassist-candidate-00N000000000001'));
    fireEvent.click(shadow.getByTestId('addassist-candidate-00N000000000002'));
    await settle();
    failRender.when = 'adding';
    const current = u2.addComponent.nextDeferred();

    fireEvent.click(shadow.getByTestId('addassist-add'));
    await settle();

    expect(shadow.getByTestId('addassist-aborted')).toHaveTextContent('追加を途中で止めました');
    expect(watch.isRegistered()).toBe(true);
    current.resolve(ok(undefined));
    await settle();

    expect(watch.isRegistered()).toBe(false);
    expect(u2.addComponent.calls.map((call) => call.componentKey)).toEqual(['00N000000000001']);
    await vi.waitFor(() =>
      expect(errorLogKeys()).toEqual(
        expect.arrayContaining(['errorLog.addAssistRenderFailed', 'errorLog.addAssistAborted']),
      ),
    );
  });
});
