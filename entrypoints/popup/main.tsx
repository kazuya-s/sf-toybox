/**
 * Entry of the toolbar popup.
 * It only mounts the U3 screen from src/changeset-viewer/ui/ (cicd-pipeline.md stage 2).
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
