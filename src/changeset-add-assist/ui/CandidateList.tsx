/**
 * チェック欄つきの候補の一覧と、一致 0 件の案内（frontend-components.md、BR2.3、BR2.4、NFR7.4）。
 * 絞り込んだ行だけを描く。名前と親オブジェクトは React の通常の表示だけで出す（NFR3.1）。
 */
import type { AddCandidate } from '../../changeset/index';
import { t } from '../../i18n/presentation';

export type CandidateListProps = {
  candidates: readonly AddCandidate[];
  selection: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (componentKey: string) => void;
};

export function CandidateList({ candidates, selection, disabled, onToggle }: CandidateListProps) {
  if (candidates.length === 0) {
    return <p data-testid="addassist-no-match">{t('addAssist.noMatch')}</p>;
  }
  return (
    <ul className="sftoybox-add-assist__list" data-testid="addassist-candidates">
      {candidates.map((candidate) => (
        <li key={candidate.componentKey} className="slds-checkbox">
          <label>
            <input
              type="checkbox"
              checked={selection.has(candidate.componentKey)}
              disabled={disabled}
              data-testid={`addassist-candidate-${candidate.componentKey}`}
              onChange={() => onToggle(candidate.componentKey)}
            />
            <span>{candidate.name}</span>
            {candidate.parentObject !== null ? (
              <span className="sftoybox-add-assist__parent-name">{candidate.parentObject}</span>
            ) : null}
          </label>
        </li>
      ))}
    </ul>
  );
}
