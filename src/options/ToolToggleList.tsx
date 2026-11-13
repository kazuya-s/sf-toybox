import type { ToolEnabledValue } from '../settings/stored-settings';
import { TOOL_DEFINITIONS, type ToolId } from '../shared/tool-ids';
import { ToolToggle } from './ToolToggle';

export type ToolToggleListProps = {
  values: readonly ToolEnabledValue[];
  onToggle: (toolId: ToolId, enabled: boolean) => void;
};

/** 組み込まれたツールを順に並べる */
export function ToolToggleList({ values, onToggle }: ToolToggleListProps) {
  return (
    <ul className="tool-toggle-list" data-testid="tool-toggle-list">
      {TOOL_DEFINITIONS.map((definition) => (
        <ToolToggle
          key={definition.toolId}
          definition={definition}
          enabled={values.find((value) => value.toolId === definition.toolId)?.enabled ?? true}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}
