/**
 * 入口から追加の結果までの結合テスト（U4 cicd-pipeline.md 段階 4、NFR7.2、NFR7.5、NFR8.1、NFR5.1）。
 * 本物の入口（entrypoints/salesforce.content.ts）・判定・設定・エラーの記録・部品の読み込み・状態・画面を、
 * U2 の差し替え（tests/u4/helpers/u2-mock.ts）だけでつなぐ。
 * 部品の読み込みは本物の import(chrome.runtime.getURL(...)) を通し、getURL だけをビルドの代わりのファイルへ向ける。
 */
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSalesforceContent } from '../../../entrypoints/salesforce.content';
import { CHANGESET_ADD_ASSIST_PATH } from '../../../src/changeset-add-assist/load';
import { ADD_ASSIST_HOST_ATTRIBUTE } from '../../../src/changeset-add-assist/mount';
import { PAGE_INFO_CHANNEL } from '../../../src/page/page-info-responder';
import { ok } from '../../../src/shared/result';
import { TOOL_DEFINITIONS, type ToolDefinition } from '../../../src/shared/tool-ids';
import { dispatchRuntimeMessage, mockState } from '../../u1/helpers/chrome-mock';
import { restoreFrame, setEmbeddedFrame, setFrameUrl } from '../../u1/fixtures/pages';
import { validSettings } from '../../u1/fixtures/settings';
import { TEST_CHANGE_SET_ID } from '../helpers/fixtures';
import { ADD_PAGE_URL, DETAIL_PAGE_URL, addPageHtml, setBody, settle } from '../helpers/page';
import { u2 } from '../helpers/u2-mock';

vi.mock('../../../src/changeset/index', async (importOriginal) =>
  (await import('../helpers/u2-mock')).mockChangesetModule(await importOriginal()),
);
vi.mock('../../../src/salesforce/index', async () =>
  (await import('../helpers/u2-mock')).mockSalesforceModule(),
);

/** ビルドした changeset-add-assist.js の代わり（WXT の包み方をまねたもの） */
const BUILT_ENTRY = resolve(process.cwd(), 'tests/u4/helpers/built-entry.ts');

/**
 * 設定画面への登録（TOOL_DEFINITIONS）は U3 が受け持つ。U3 がまだ入っていないときだけ、
 * 登録された状態をここで作り、OFF の保存値が本物の isEnabled で読まれるようにする。
 */
const ADD_ASSIST_DEFINITION = {
  toolId: 'changeset-add-assist',
  nameKey: 'addAssist.title',
  descriptionKey: 'addAssist.title',
  defaultEnabled: true,
} satisfies ToolDefinition;
const definitions = TOOL_DEFINITIONS as ToolDefinition[];
let registeredHere = false;

function shadowOf(): ReturnType<typeof within> {
  const host = document.querySelector(`[${ADD_ASSIST_HOST_ATTRIBUTE}]`);
  if (!host?.shadowRoot) throw new Error('追加支援が置かれていません');
  return within(host.shadowRoot as unknown as HTMLElement);
}

async function runOn(url: string, html: string = addPageHtml()): Promise<void> {
  setFrameUrl(url);
  setBody(html);
  await act(() => runSalesforceContent());
  await settle();
}

function errorLogKeys(): unknown[] {
  const log = (mockState().local.errorLog as { messageKey: string }[] | undefined) ?? [];
  return log.map((entry) => entry.messageKey);
}

describe('入口から追加支援まで（content-to-add-assist）', () => {
  let getUrl: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    if (!definitions.some((definition) => definition.toolId === 'changeset-add-assist')) {
      definitions.push(ADD_ASSIST_DEFINITION);
      registeredHere = true;
    }
  });

  afterAll(() => {
    if (registeredHere) definitions.splice(definitions.indexOf(ADD_ASSIST_DEFINITION), 1);
  });

  beforeEach(() => {
    u2.reset();
    setEmbeddedFrame(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getUrl = vi
      .spyOn(chrome.runtime, 'getURL')
      .mockImplementation((path: string) =>
        path === CHANGESET_ADD_ASSIST_PATH ? BUILT_ENTRY : `chrome-extension://test${path}`,
      );
  });

  afterEach(() => {
    document.body.replaceChildren();
    restoreFrame();
  });

  it('OFF のとき、または「追加」画面でないときは、部品を読み込まず U2 も呼ばない（NFR7.2、BR1.1）', async () => {
    mockState().local.settings = validSettings({ 'changeset-add-assist': { enabled: false } });
    await runOn(ADD_PAGE_URL);
    expect(getUrl).not.toHaveBeenCalledWith(CHANGESET_ADD_ASSIST_PATH);
    expect(document.querySelector(`[${ADD_ASSIST_HOST_ATTRIBUTE}]`)).toBeNull();

    mockState().local.settings = validSettings({ 'changeset-add-assist': { enabled: true } });
    await runOn(DETAIL_PAGE_URL);
    expect(getUrl).not.toHaveBeenCalledWith(CHANGESET_ADD_ASSIST_PATH);
    expect(document.querySelector(`[${ADD_ASSIST_HOST_ATTRIBUTE}]`)).toBeNull();
    expect(u2.callLog).toEqual([]);
  });

  it('ON の「追加」画面では部品が置かれ、3 つの呼び出しが同時に始まる（NFR7.5）', async () => {
    const name = u2.getChangeSet.nextDeferred();

    await runOn(ADD_PAGE_URL);

    expect(getUrl).toHaveBeenCalledWith(CHANGESET_ADD_ASSIST_PATH);
    expect(u2.callLog.map((entry) => entry.name)).toEqual([
      'getChangeSet',
      'checkAddPreconditions',
      'listAddCandidates',
    ]);
    expect(u2.getChangeSet.calls[0]).toEqual({ changeSetId: TEST_CHANGE_SET_ID });
    expect(shadowOf().getByTestId('addassist-target')).toHaveTextContent('読み込んでいます…');
    name.resolve(ok({ changeSetId: TEST_CHANGE_SET_ID, name: 'Test Change Set', status: 'open' }));
    await settle();
    expect(shadowOf().getByTestId('addassist-target')).toHaveTextContent('追加先: Test Change Set');
  });

  it('選んで追加し、結果が出るまでの流れ（BR3.1、BR3.4）', async () => {
    await runOn(ADD_PAGE_URL);
    const shadow = shadowOf();

    fireEvent.click(shadow.getByTestId('addassist-candidate-00N000000000003'));
    fireEvent.click(shadow.getByTestId('addassist-candidate-00N000000000001'));
    await settle();
    fireEvent.click(shadow.getByTestId('addassist-add'));
    await settle();

    expect(u2.addComponent.calls).toEqual([
      {
        changeSetId: TEST_CHANGE_SET_ID,
        componentType: 'CustomField',
        componentKey: '00N000000000001',
      },
      {
        changeSetId: TEST_CHANGE_SET_ID,
        componentType: 'CustomField',
        componentKey: '00N000000000003',
      },
    ]);
    expect(shadow.getByTestId('addassist-result-succeeded')).toHaveTextContent(
      'TestAmount__cTestStatus__c',
    );
  });

  it('2 件目で失敗すると止まり、結果に 3 つの一覧が出る（BR3.3、NFR3.5）', async () => {
    await runOn(ADD_PAGE_URL);
    const shadow = shadowOf();
    for (const key of ['00N000000000001', '00N000000000002', '00N000000000005']) {
      fireEvent.click(shadow.getByTestId(`addassist-candidate-${key}`));
    }
    await settle();
    u2.addComponent.next(ok(undefined)).nextFail('permissionDenied');

    fireEvent.click(shadow.getByTestId('addassist-add'));
    await settle();

    expect(u2.addComponent.calls).toHaveLength(2);
    expect(shadow.getByTestId('addassist-result-succeeded')).toHaveTextContent('TestAmount__c');
    expect(shadow.getByTestId('addassist-result-failed')).toHaveTextContent('TestCode__c');
    expect(shadow.getByTestId('addassist-result-untried')).toHaveTextContent('TestNote__c');
  });

  it('部品の読み込みに失敗しても例外が外に出ず、記録され、画面の問い合わせへの応答は続く（NFR5.1）', async () => {
    getUrl.mockImplementation(() => resolve(process.cwd(), 'tests/u4/helpers/missing-entry.ts'));

    await expect(runOn(ADD_PAGE_URL)).resolves.toBeUndefined();

    expect(document.querySelector(`[${ADD_ASSIST_HOST_ATTRIBUTE}]`)).toBeNull();
    await waitFor(() => expect(errorLogKeys()).toContain('errorLog.addAssistLoadFailed'));
    vi.useFakeTimers();
    const answer = dispatchRuntimeMessage({ channel: PAGE_INFO_CHANNEL });
    await vi.advanceTimersByTimeAsync(200);
    await expect(answer).resolves.toMatchObject({
      ok: true,
      value: { pageKind: 'outboundChangeSetAdd' },
    });
  });

  it('組織の種類（ホスト名）で動きを変えない（NFR8.1、BR3.8）', async () => {
    const hosts = ['example.my.salesforce.com', 'example--dev.sandbox.my.salesforce.com'];
    for (const host of hosts) {
      u2.reset();
      document.body.replaceChildren();
      await runOn(`https://${host}/p/mfpkg/AddToPackageFromChangeMgmtUi?id=${TEST_CHANGE_SET_ID}`);

      expect(shadowOf().getByTestId('addassist-card')).toBeInTheDocument();
      expect(u2.callLog.map((entry) => [entry.name, entry.arg])).toEqual([
        ['getChangeSet', { changeSetId: TEST_CHANGE_SET_ID }],
        ['checkAddPreconditions', { changeSetId: TEST_CHANGE_SET_ID }],
        ['listAddCandidates', { changeSetId: TEST_CHANGE_SET_ID, componentType: 'CustomField' }],
      ]);
    }
  });
});
