import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Test config for the SPA.
//
// This app shipped for months with no test runner at all. Every one of the
// backend's 559 automated checks stopped at the HTTP boundary, so a review that
// actually LOADED the pages found 45 real defects — including one where a bad
// snapshot in useSyncExternalStore blanked every route in the application while
// `tsc --noEmit` stayed perfectly green. Typecheck cannot see behaviour. This
// runner exists so behaviour is asserted somewhere other than my own eyes.
//
// jsdom rather than a real browser on purpose: the browser automation available
// here cannot open a MUI Select (its menu is portalled and never receives the
// synthetic click), so the very components most worth testing are the ones it
// cannot reach. Under jsdom, Testing Library drives them properly.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // A run that silently matched no files would report success. It must not.
    passWithNoTests: false,
    restoreMocks: true,
  },
});
