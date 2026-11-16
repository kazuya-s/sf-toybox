import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageSizeBar } from '../../../src/page-size/PageSizeBar';
import { setUiLanguage } from '../helpers/chrome-mock';
import { urls } from '../fixtures/pages';

function renderBar(href: string = urls.listWithRowsPerPage) {
  const navigate = vi.fn<(url: string) => void>();
  render(<PageSizeBar href={href} navigate={navigate} />);
  return { navigate, user: userEvent.setup() };
}

function rowsPerPageOf(url: string | undefined): string | null {
  return url ? new URL(url).searchParams.get('rowsperpage') : null;
}

describe('Page-size bar (PageSizeBar)', () => {
  it('shows four buttons, an input and "Show" (BR3.1, AC2.1.1)', () => {
    renderBar();

    for (const size of [100, 500, 1000, 2000]) {
      expect(screen.getByTestId(`page-size-bar-preset-${size}`)).toHaveTextContent(String(size));
    }
    expect(screen.getByTestId('page-size-bar-input')).toBeInTheDocument();
    expect(screen.getByTestId('page-size-bar-apply')).toHaveTextContent('表示');
    expect(screen.getByTestId('page-size-bar')).toHaveTextContent('表示件数');
  });

  it('highlights only the button for the current size (BR3.4, AC2.1.6)', () => {
    renderBar(urls.listWithRowsPerPage);

    expect(screen.getByTestId('page-size-bar-preset-500')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('page-size-bar-preset-500')).toHaveClass('slds-button_brand');
    for (const size of [100, 1000, 2000]) {
      expect(screen.getByTestId(`page-size-bar-preset-${size}`)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('a button reopens the page with rowsperpage replaced (AC2.1.2, AC2.1.5)', async () => {
    const { navigate, user } = renderBar(urls.listWithRowsPerPage);

    await user.click(screen.getByTestId('page-size-bar-preset-1000'));

    expect(navigate).toHaveBeenCalledTimes(1);
    const next = new URL(navigate.mock.calls[0]?.[0] ?? '');
    expect(next.searchParams.get('rowsperpage')).toBe('1000');
    expect(next.searchParams.get('setupid')).toBe('ApexClasses');
    expect(next.searchParams.get('retURL')).toBe('/setup');
  });

  it('Enter with valid input reopens the page (AC2.1.3)', async () => {
    const { navigate, user } = renderBar(urls.listWithoutRowsPerPage);

    await user.type(screen.getByTestId('page-size-bar-input'), ' 3000 {Enter}');

    expect(rowsPerPageOf(navigate.mock.calls[0]?.[0])).toBe('3000');
  });

  it.each(['0', '-5', '1.5', 'abc', '10"><script>'])(
    'invalid input (%s) does not reopen, shows a hint and keeps the typed text (AC2.1.4)',
    async (input) => {
      const { navigate, user } = renderBar();
      const field = screen.getByTestId('page-size-bar-input');

      await user.type(field, `${input}{Enter}`);

      expect(navigate).not.toHaveBeenCalled();
      expect(screen.getByTestId('page-size-bar-hint')).toHaveTextContent(
        '1 以上の整数を入力してください',
      );
      expect(field).toHaveValue(input);
      expect(field).toHaveAttribute('aria-invalid', 'true');
    },
  );

  it('pressing "Show" while empty shows the hint, and "Show" confirms once the value is valid', async () => {
    const { navigate, user } = renderBar();

    await user.click(screen.getByTestId('page-size-bar-apply'));
    expect(screen.getByTestId('page-size-bar-hint')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    await user.type(screen.getByTestId('page-size-bar-input'), '250');
    expect(screen.queryByTestId('page-size-bar-hint')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('page-size-bar-apply'));

    expect(rowsPerPageOf(navigate.mock.calls[0]?.[0])).toBe('250');
  });

  it('HTML-like strings are not rendered as HTML (NFR3.3)', async () => {
    const { user } = renderBar();
    const field = screen.getByTestId('page-size-bar-input');

    await user.type(field, '<img src=x onerror=alert(1)>{Enter}');

    expect(document.querySelector('img')).toBeNull();
    expect(field).toHaveValue('<img src=x onerror=alert(1)>');
  });

  it('uses English messages in an English environment (BR4.1)', () => {
    setUiLanguage('en-US');
    renderBar();

    expect(screen.getByTestId('page-size-bar-apply')).toHaveTextContent('Show');
    expect(screen.getByTestId('page-size-bar')).toHaveTextContent('Rows per page');
  });
});
