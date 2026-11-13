/**
 * tests/u3/fixtures/*.json の架空の一覧を、C4 の ChangeSetComponents の形として読む。
 * 形が C4 と違えば、読み込みの時点で失敗させる（テストのデータが本物の形からずれないため）。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  ChangeSetComponent,
  ChangeSetComponents,
  ChangeSetStatus,
  OutboundChangeSet,
} from '../../../src/changeset';

const FIXTURE_DIR = resolve(process.cwd(), 'tests/u3/fixtures');
const STATUSES: readonly ChangeSetStatus[] = ['open', 'uploaded', 'unknown'];

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf8')) as Record<string, unknown>;
}

function asChangeSet(raw: unknown): OutboundChangeSet {
  const value = raw as Record<string, unknown>;
  if (
    typeof value?.changeSetId !== 'string' ||
    typeof value.name !== 'string' ||
    !STATUSES.includes(value.status as ChangeSetStatus)
  ) {
    throw new TypeError('fixture: changeSet の形が C4 と違います');
  }
  return value as OutboundChangeSet;
}

function asComponent(raw: unknown): ChangeSetComponent {
  const value = raw as Record<string, unknown>;
  if (
    typeof value?.componentType !== 'string' ||
    typeof value.apiName !== 'string' ||
    !(value.parentObject === null || typeof value.parentObject === 'string')
  ) {
    throw new TypeError('fixture: component の形が C4 と違います');
  }
  return value as ChangeSetComponent;
}

export type ComponentsFixture =
  'components-basic' | 'components-unsafe-names' | 'components-no-parent';

/** 一覧の結果の例を読む。毎回新しいオブジェクトを返す */
export function loadComponents(name: ComponentsFixture): ChangeSetComponents {
  const raw = readJson(`${name}.json`);
  if (!Array.isArray(raw.components) || typeof raw.complete !== 'boolean') {
    throw new TypeError(`fixture ${name}: C4 の形と違います`);
  }
  return {
    changeSet: asChangeSet(raw.changeSet),
    components: raw.components.map(asComponent),
    complete: raw.complete,
    failedPages: Number(raw.failedPages),
  };
}

/** components-many.json の作り方で、2000 件の一覧を作る（NFR7.4） */
export function buildManyComponents(): ChangeSetComponents {
  const raw = readJson('components-many.json');
  const count = Number(raw.count);
  const types = raw.componentTypes as string[];
  const prefix = String(raw.apiNamePrefix);
  const components: ChangeSetComponent[] = Array.from({ length: count }, (_, index) => ({
    componentType: types[index % types.length] ?? 'Apex Class',
    apiName: `${prefix}${String(count - index).padStart(4, '0')}`,
    parentObject: index % 3 === 0 ? null : String(raw.parentObject),
  }));
  return { changeSet: asChangeSet(raw.changeSet), components, complete: true, failedPages: 0 };
}
