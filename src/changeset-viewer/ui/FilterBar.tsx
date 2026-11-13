/** 絞り込み: 名前（BR2.3）と種類（BR2.4） */
import type { Ref } from 'react';
import { t } from '../../i18n/presentation';
import type { RowFilter } from '../types';

export type FilterBarProps = {
  filter: RowFilter;
  types: readonly string[];
  onChange: (filter: RowFilter) => void;
  nameInputRef?: Ref<HTMLInputElement>;
};

type NameFilterInputProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
};

export function NameFilterInput({ value, onChange, inputRef }: NameFilterInputProps) {
  return (
    <label>
      <span>{t('viewer.nameFilter')}</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        data-testid="viewer-name-filter"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

type TypeFilterSelectProps = {
  value: string | null;
  types: readonly string[];
  onChange: (value: string | null) => void;
};

export function TypeFilterSelect({ value, types, onChange }: TypeFilterSelectProps) {
  return (
    <label>
      <span>{t('viewer.typeFilter')}</span>
      <select
        value={value ?? ''}
        data-testid="viewer-type-filter"
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">{t('viewer.typeAll')}</option>
        {types.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ filter, types, onChange, nameInputRef }: FilterBarProps) {
  return (
    <div className="viewer__filters">
      <NameFilterInput
        value={filter.name}
        inputRef={nameInputRef}
        onChange={(name) => onChange({ ...filter, name })}
      />
      <TypeFilterSelect
        value={filter.type}
        types={types}
        onChange={(type) => onChange({ ...filter, type })}
      />
    </div>
  );
}
