/**
 * Reads the fake lists in tests/u3/fixtures/*.json as C4 ChangeSetComponents.
 * Fails at load time if the shape differs from C4 (so test data never drifts from the real shape).
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
    throw new TypeError('fixture: changeSet does not match the C4 shape');
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
    throw new TypeError('fixture: component does not match the C4 shape');
  }
  return value as ChangeSetComponent;
}

export type ComponentsFixture =
  'components-basic' | 'components-unsafe-names' | 'components-no-parent';

/** Reads an example list result. Returns a new object every time */
export function loadComponents(name: ComponentsFixture): ChangeSetComponents {
  const raw = readJson(`${name}.json`);
  if (!Array.isArray(raw.components) || typeof raw.complete !== 'boolean') {
    throw new TypeError(`fixture ${name}: does not match the C4 shape`);
  }
  return {
    changeSet: asChangeSet(raw.changeSet),
    components: raw.components.map(asComponent),
    complete: raw.complete,
    failedPages: Number(raw.failedPages),
  };
}

/** Builds a 2000-item list following components-many.json (NFR7.4) */
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
