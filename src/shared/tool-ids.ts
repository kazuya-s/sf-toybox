/**
 * Tool IDs and the list of tools bundled in the extension (contract-summary.md C1).
 * The tool list is a definition, not stored data; tools with no stored value use defaultEnabled (ON).
 */
import type { MessageKey } from '../i18n/message-keys';

export const TOOL_IDS = ['page-size-switcher', 'changeset-viewer', 'changeset-add-assist'] as const;

export type ToolId = (typeof TOOL_IDS)[number];

/** IDs used in the error log: each tool, plus core for shared parts */
export type LogToolId = ToolId | 'core';

export type ToolDefinition = {
  toolId: ToolId;
  /** Message key of the name (design key) */
  nameKey: MessageKey;
  /** Message key of the description (design key) */
  descriptionKey: MessageKey;
  defaultEnabled: true;
};

/**
 * Tools shown on the options page. U1 had only the page-size switcher.
 * U3 and U4 add their own tools here in their units (frontend-components.md).
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    toolId: 'page-size-switcher',
    nameKey: 'tool.pageSize.name',
    descriptionKey: 'tool.pageSize.description',
    defaultEnabled: true,
  },
  // U3 adds both changeset-viewer and changeset-add-assist (U4 does not change this file)
  {
    toolId: 'changeset-viewer',
    nameKey: 'tool.changesetViewer.name',
    descriptionKey: 'tool.changesetViewer.description',
    defaultEnabled: true,
  },
  {
    toolId: 'changeset-add-assist',
    nameKey: 'tool.changesetAddAssist.name',
    descriptionKey: 'tool.changesetAddAssist.description',
    defaultEnabled: true,
  },
];

export function isToolId(value: unknown): value is ToolId {
  return typeof value === 'string' && (TOOL_IDS as readonly string[]).includes(value);
}
