/**
 * Reads U4 test data (tests/u4/fixtures/*.json) as U2 types (C5 AddCandidate).
 * It is read with types, so a change in U2's shape becomes a type error here.
 * Returns a new array every time; nothing is shared between tests.
 */
import type { AddCandidate } from '../../../src/changeset/index';
import basic from '../fixtures/candidates-basic.json';
import generated from '../fixtures/candidates-generated.json';
import html from '../fixtures/candidates-html.json';
import noParent from '../fixtures/candidates-no-parent.json';

export const TEST_ORG_HOST = basic.orgHost;
export const TEST_CHANGE_SET_ID = basic.changeSetId;
export const TEST_CHANGE_SET_NAME = basic.changeSetName;
/** Value of the type select on the "Add" page (test default) */
export const TEST_COMPONENT_TYPE = basic.componentType;

const FIXTURES: Record<'basic' | 'html' | 'noParent', readonly AddCandidate[]> = {
  basic: basic.candidates,
  html: html.candidates,
  noParent: noParent.candidates,
};

export type CandidateFixtureName = keyof typeof FIXTURES;

export function candidatesFixture(name: CandidateFixtureName): AddCandidate[] {
  return FIXTURES[name].map((candidate) => ({ ...candidate }));
}

/** Builds fake candidates following candidates-generated.json (the 2000 items of NFR7.4) */
export function generatedCandidates(count: number = generated.count): AddCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const serial = String(index + 1).padStart(generated.keyDigits, '0');
    return {
      componentKey: `${generated.keyPrefix}${serial}`,
      name: `${generated.namePrefix}${serial}__c`,
      parentObject: generated.parentObjects[index % generated.parentObjects.length] ?? null,
      typeLabel: generated.typeLabel,
    };
  });
}
