/**
 * ツールの識別子と、拡張機能に組み込まれたツールの一覧（contract-summary.md C1）。
 * ツールの一覧は保存しない定義で、保存値のないツールは defaultEnabled（ON）を使う。
 */
import type { MessageKey } from '../i18n/message-keys';

export const TOOL_IDS = ['page-size-switcher', 'changeset-viewer', 'changeset-add-assist'] as const;

export type ToolId = (typeof TOOL_IDS)[number];

/** エラーの記録で使う識別子。各ツールに、共通の部分を表す core を足したもの */
export type LogToolId = ToolId | 'core';

export type ToolDefinition = {
  toolId: ToolId;
  /** 名前の文言キー（設計のキー） */
  nameKey: MessageKey;
  /** 説明の文言キー（設計のキー） */
  descriptionKey: MessageKey;
  defaultEnabled: true;
};

/**
 * 設定画面に表示するツール。U1 では件数の切り替えだけ。
 * U3・U4 は、それぞれの作業単位で自分のツールをここに足す（frontend-components.md）。
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    toolId: 'page-size-switcher',
    nameKey: 'tool.pageSize.name',
    descriptionKey: 'tool.pageSize.description',
    defaultEnabled: true,
  },
];

export function isToolId(value: unknown): value is ToolId {
  return typeof value === 'string' && (TOOL_IDS as readonly string[]).includes(value);
}
