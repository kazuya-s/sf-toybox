/**
 * 件数バー（frontend-components.md の PageSizeBar、mockups.md S2、BR3.1〜BR3.5）。
 * 文言は React の通常の表示（文字として扱われる）だけで出す（NFR3.3）。
 */
import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { t } from '../i18n/presentation';
import { PRESET_SIZES, buildPageSizeUrl, parsePageSizeInput, selectedPreset } from './page-size';

export type PageSizeBarProps = {
  /** このフレームの URL */
  href: string;
  /** 新しい URL でこのフレームを開き直す。既定は location.assign */
  navigate?: (url: string) => void;
};

function assignLocation(url: string): void {
  window.location.assign(url);
}

function PresetButtons({
  current,
  onSelect,
}: {
  current: number | null;
  onSelect: (size: number) => void;
}) {
  return (
    <div
      className="slds-button-group"
      role="group"
      aria-label={t('pageSize.label')}
      data-testid="page-size-bar-presets"
    >
      {PRESET_SIZES.map((size) => {
        const isSelected = size === current;
        return (
          <button
            key={size}
            type="button"
            className={`slds-button ${isSelected ? 'slds-button_brand' : 'slds-button_neutral'}`}
            aria-pressed={isSelected}
            data-testid={`page-size-bar-preset-${size}`}
            onClick={() => onSelect(size)}
          >
            {size}
          </button>
        );
      })}
    </div>
  );
}

function InputHint({ id }: { id: string }) {
  return (
    <div className="slds-form-element__help" id={id} data-testid="page-size-bar-hint">
      {t('pageSize.invalid')}
    </div>
  );
}

function CustomSizeInput({ onSubmitSize }: { onSubmitSize: (size: string) => void }) {
  const [text, setText] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);
  const hintId = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setIsInvalid(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const size = parsePageSizeInput(text);
    if (size === null) {
      // 開き直さず、正しい入力の形を示す。入力した文字は消さない（BR3.2）
      setIsInvalid(true);
      return;
    }
    onSubmitSize(size);
  };

  return (
    <form
      className="sftoybox-bar__custom"
      noValidate
      onSubmit={handleSubmit}
      data-testid="page-size-bar-form"
    >
      <div className={`slds-form-element${isInvalid ? ' slds-has-error' : ''}`}>
        <div className="slds-form-element__control">
          <input
            type="text"
            inputMode="numeric"
            className="slds-input"
            value={text}
            placeholder={t('pageSize.inputPlaceholder')}
            aria-label={t('pageSize.inputLabel')}
            aria-invalid={isInvalid}
            aria-describedby={isInvalid ? hintId : undefined}
            data-testid="page-size-bar-input"
            onChange={handleChange}
          />
        </div>
        {isInvalid ? <InputHint id={hintId} /> : null}
      </div>
      <button
        type="submit"
        className="slds-button slds-button_neutral"
        data-testid="page-size-bar-apply"
      >
        {t('pageSize.apply')}
      </button>
    </form>
  );
}

export function PageSizeBar({ href, navigate = assignLocation }: PageSizeBarProps) {
  const reopenWith = (size: number | string) => navigate(buildPageSizeUrl(href, size));

  return (
    <div className="sftoybox-bar" data-testid="page-size-bar">
      <span className="sftoybox-bar__label">{t('pageSize.label')}</span>
      <PresetButtons current={selectedPreset(href)} onSelect={reopenWith} />
      <CustomSizeInput onSubmitSize={reopenWith} />
    </div>
  );
}
