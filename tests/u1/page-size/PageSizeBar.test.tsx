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

describe('件数バー（PageSizeBar）', () => {
  it('4 つのボタンと入力欄と「表示」が出る（BR3.1、AC2.1.1）', () => {
    renderBar();

    for (const size of [100, 500, 1000, 2000]) {
      expect(screen.getByTestId(`page-size-bar-preset-${size}`)).toHaveTextContent(String(size));
    }
    expect(screen.getByTestId('page-size-bar-input')).toBeInTheDocument();
    expect(screen.getByTestId('page-size-bar-apply')).toHaveTextContent('表示');
    expect(screen.getByTestId('page-size-bar')).toHaveTextContent('表示件数');
  });

  it('今の件数のボタンだけが強調される（BR3.4、AC2.1.6）', () => {
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

  it('ボタンを押すと rowsperpage を置き換えた URL で開き直す（AC2.1.2、AC2.1.5）', async () => {
    const { navigate, user } = renderBar(urls.listWithRowsPerPage);

    await user.click(screen.getByTestId('page-size-bar-preset-1000'));

    expect(navigate).toHaveBeenCalledTimes(1);
    const next = new URL(navigate.mock.calls[0]?.[0] ?? '');
    expect(next.searchParams.get('rowsperpage')).toBe('1000');
    expect(next.searchParams.get('setupid')).toBe('ApexClasses');
    expect(next.searchParams.get('retURL')).toBe('/setup');
  });

  it('正しい入力で Enter を押すと開き直す（AC2.1.3）', async () => {
    const { navigate, user } = renderBar(urls.listWithoutRowsPerPage);

    await user.type(screen.getByTestId('page-size-bar-input'), ' 3000 {Enter}');

    expect(rowsPerPageOf(navigate.mock.calls[0]?.[0])).toBe('3000');
  });

  it.each(['0', '-5', '1.5', 'abc', '10"><script>'])(
    '正しくない入力（%s）では開き直さず、案内を出し、入力した文字を残す（AC2.1.4）',
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

  it('空のまま「表示」を押すと案内を出し、正しい値にして「表示」で確定できる', async () => {
    const { navigate, user } = renderBar();

    await user.click(screen.getByTestId('page-size-bar-apply'));
    expect(screen.getByTestId('page-size-bar-hint')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    await user.type(screen.getByTestId('page-size-bar-input'), '250');
    expect(screen.queryByTestId('page-size-bar-hint')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('page-size-bar-apply'));

    expect(rowsPerPageOf(navigate.mock.calls[0]?.[0])).toBe('250');
  });

  it('HTML 風の文字列は HTML として表示されない（NFR3.3）', async () => {
    const { user } = renderBar();
    const field = screen.getByTestId('page-size-bar-input');

    await user.type(field, '<img src=x onerror=alert(1)>{Enter}');

    expect(document.querySelector('img')).toBeNull();
    expect(field).toHaveValue('<img src=x onerror=alert(1)>');
  });

  it('英語の環境では英語の文言で出す（BR4.1）', () => {
    setUiLanguage('en-US');
    renderBar();

    expect(screen.getByTestId('page-size-bar-apply')).toHaveTextContent('Show');
    expect(screen.getByTestId('page-size-bar')).toHaveTextContent('Rows per page');
  });
});
