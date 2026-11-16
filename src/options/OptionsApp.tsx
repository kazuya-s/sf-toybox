/**
 * Options page (OptionsApp in frontend-components.md, mockups.md S1, functional-spec.md F1, F2).
 * Layout: LoadFailedBanner, ToolToggleList (ToolToggle), SavedNotice, RecentErrors, SupportLink
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n/presentation';
import type { ToolEnabledValue } from '../settings/stored-settings';
import { getAll, setEnabled } from '../settings/tool-settings';
import type { ToolId } from '../shared/tool-ids';
import { LoadFailedBanner } from './LoadFailedBanner';
import { RecentErrors } from './RecentErrors';
import { SAVED_NOTICE_MS, SavedNotice } from './SavedNotice';
import { SupportLink } from './SupportLink';
import { ToolToggleList } from './ToolToggleList';

export type OptionsAppProps = {
  /** Support URL; null if not configured */
  supportUrl: string | null;
};

function withValue(values: ToolEnabledValue[], toolId: ToolId, enabled: boolean) {
  return values.map((value) => (value.toolId === toolId ? { toolId, enabled } : value));
}

function useSavedNotice() {
  const [isVisible, setIsVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIsVisible(true);
    timer.current = setTimeout(() => setIsVisible(false), SAVED_NOTICE_MS);
  }, []);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIsVisible(false);
  }, []);

  return { isVisible, show, hide };
}

export function OptionsApp({ supportUrl }: OptionsAppProps) {
  const [values, setValues] = useState<ToolEnabledValue[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const [errorsVersion, setErrorsVersion] = useState(0);
  const savedNotice = useSavedNotice();

  useEffect(() => {
    let isActive = true;
    void getAll().then((all) => {
      if (!isActive) return;
      setValues(all.settings);
      setLoadFailed(all.loadFailed);
      if (all.loadFailed) setErrorsVersion((version) => version + 1);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const handleToggle = async (toolId: ToolId, enabled: boolean) => {
    // Show the new value immediately and request the save (ToolSettings saves one at a time; BR1.5)
    setValues((current) => (current ? withValue(current, toolId, enabled) : current));
    setHasSaveFailed(false);
    const result = await setEnabled({ toolId, enabled });
    if (result.ok) {
      savedNotice.show();
      return;
    }
    // If saving fails, revert to the previous value and tell the user
    setValues((current) => (current ? withValue(current, toolId, !enabled) : current));
    savedNotice.hide();
    setHasSaveFailed(true);
    setErrorsVersion((version) => version + 1);
  };

  return (
    <div className="options" data-testid="options-app">
      <header className="options__header">
        <h1>{t('options.title')}</h1>
      </header>
      {loadFailed ? <LoadFailedBanner /> : null}
      <section className="panel" aria-labelledby="tools-heading">
        <h2 id="tools-heading">{t('options.toolsHeading')}</h2>
        <p className="note" data-testid="options-reload-note">
          {t('options.toolsIntro')} {t('options.reloadNote')}
        </p>
        {values ? (
          <ToolToggleList
            values={values}
            onToggle={(toolId, enabled) => void handleToggle(toolId, enabled)}
          />
        ) : null}
        <SavedNotice visible={savedNotice.isVisible} />
        {hasSaveFailed ? (
          <p className="message message--error" role="alert" data-testid="options-save-failed">
            {t('options.saveFailed')}
          </p>
        ) : null}
      </section>
      <RecentErrors refreshKey={errorsVersion} />
      <footer className="options__footer">
        <SupportLink url={supportUrl} />
      </footer>
    </div>
  );
}
