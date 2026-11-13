import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { installChromeMock, resetChromeMock } from './chrome-mock';

installChromeMock();

beforeEach(() => {
  resetChromeMock();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
