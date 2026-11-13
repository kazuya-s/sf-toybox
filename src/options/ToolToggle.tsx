import { useId } from 'react';
import { t } from '../i18n/presentation';
import type { ToolDefinition, ToolId } from '../shared/tool-ids';

export type ToolToggleProps = {
  definition: ToolDefinition;
  enabled: boolean;
  onToggle: (toolId: ToolId, enabled: boolean) => void;
};

/** ツール 1 つの名前・説明・切り替え（BR1.5、BR1.8） */
export function ToolToggle({ definition, enabled, onToggle }: ToolToggleProps) {
  const inputId = useId();
  const descriptionId = useId();
  const { toolId } = definition;

  return (
    <li className="tool-toggle" data-testid={`tool-toggle-${toolId}`}>
      <div className="tool-toggle__text">
        <label className="tool-toggle__name" htmlFor={inputId}>
          {t(definition.nameKey)}
        </label>
        <p className="tool-toggle__description" id={descriptionId}>
          {t(definition.descriptionKey)}
        </p>
      </div>
      <span className="tool-toggle__switch">
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          checked={enabled}
          aria-describedby={descriptionId}
          data-testid={`tool-toggle-${toolId}-switch`}
          onChange={(event) => onToggle(toolId, event.target.checked)}
        />
        <span className="tool-toggle__state" aria-hidden="true">
          {enabled ? t('options.on') : t('options.off')}
        </span>
      </span>
    </li>
  );
}
