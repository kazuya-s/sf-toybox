/**
 * U4 のテストのデータ（tests/u4/fixtures/*.json）を、U2 の型（C5 の AddCandidate）として読む。
 * 型を付けて読むので、U2 の形が変わればここで型のエラーになる。
 * 毎回新しい配列を返し、テストのあいだで共有しない。
 */
import type { AddCandidate } from '../../../src/changeset/index';
import basic from '../fixtures/candidates-basic.json';
import generated from '../fixtures/candidates-generated.json';
import html from '../fixtures/candidates-html.json';
import noParent from '../fixtures/candidates-no-parent.json';

export const TEST_ORG_HOST = basic.orgHost;
export const TEST_CHANGE_SET_ID = basic.changeSetId;
export const TEST_CHANGE_SET_NAME = basic.changeSetName;
/** 「追加」画面の種類の選択欄の値（テストでの既定） */
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

/** candidates-generated.json の作り方で、架空の候補を作る（NFR7.4 の 2000 件） */
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
