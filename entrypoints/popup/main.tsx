/**
 * ツールバーの画面（ポップアップ）の入口。
 * U3 の画面を src/changeset-viewer/ui/ から読み込んで置くだけにする（cicd-pipeline.md 段階 2）。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '../../src/i18n/presentation';
import { ChangeSetViewerApp } from '../../src/changeset-viewer/ui/ChangeSetViewerApp';
import './style.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found in popup/index.html');

document.title = t('tool.changesetViewer.name');
document.documentElement.lang = chrome.i18n.getUILanguage().toLowerCase().startsWith('ja')
  ? 'ja'
  : 'en';

createRoot(container).render(
  <StrictMode>
    <ChangeSetViewerApp />
  </StrictMode>,
);
