/**
 * Search bar: NameSearchInput, ParentSelect, MatchCount (frontend-components.md, BR2.1, BR2.2).
 * Pressing Enter in the search box never adds (to prevent mistakes: no form, and Enter's default is prevented).
 */
import { useId, type KeyboardEvent } from 'react';
import { t } from '../../i18n/presentation';

export type SearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  parent: string | null;
  parents: readonly string[];
  onParentChange: (parent: string | null) => void;
  matchCount: number;
  disabled: boolean;
};

function stopEnter(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.key === 'Enter') event.preventDefault();
}

function NameSearchInput(props: Pick<SearchBarProps, 'query' | 'onQueryChange' | 'disabled'>) {
  const id = useId();
  return (
    <div className="slds-form-element">
      <label className="slds-form-element__label" htmlFor={id}>
        {t('addAssist.search')}
      </label>
      <div className="slds-form-element__control">
        <input
          id={id}
          type="search"
          className="slds-input"
          value={props.query}
          disabled={props.disabled}
          data-testid="addassist-search"
          onChange={(event) => props.onQueryChange(event.target.value)}
          onKeyDown={stopEnter}
        />
      </div>
    </div>
  );
}

function ParentSelect(
  props: Pick<SearchBarProps, 'parent' | 'parents' | 'onParentChange' | 'disabled'>,
) {
  const id = useId();
  return (
    <div className="slds-form-element sftoybox-add-assist__parent">
      <label className="slds-form-element__label" htmlFor={id}>
        {t('addAssist.parent')}
      </label>
      <div className="slds-form-element__control">
        <div className="slds-select_container">
          <select
            id={id}
            className="slds-select"
            value={props.parent ?? ''}
            disabled={props.disabled}
            data-testid="addassist-parent"
            onChange={(event) => props.onParentChange(event.target.value || null)}
          >
            <option value="">{t('addAssist.parentAll')}</option>
            {props.parents.map((parent) => (
              <option key={parent} value={parent}>
                {parent}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function SearchBar(props: SearchBarProps) {
  return (
    <div className="sftoybox-add-assist__search">
      <NameSearchInput {...props} />
      {props.parents.length > 0 ? <ParentSelect {...props} /> : null}
      <span data-testid="addassist-match-count">
        {t('addAssist.matchCount', { count: props.matchCount })}
      </span>
    </div>
  );
}
