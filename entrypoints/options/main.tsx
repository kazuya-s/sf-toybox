/** 設定画面の入口（拡張機能自身の画面。Salesforce の画面には組み込まない） */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '../../src/i18n/presentation';
import { OptionsApp } from '../../src/options/OptionsApp';
import { SUPPORT_URL } from '../../src/options/support-url';
import './style.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found in options/index.html');

document.title = t('options.title');
document.documentElement.lang = chrome.i18n.getUILanguage().toLowerCase().startsWith('ja')
  ? 'ja'
  : 'en';

createRoot(container).render(
  <StrictMode>
    <OptionsApp supportUrl={SUPPORT_URL} />
  </StrictMode>,
);
