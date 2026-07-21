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

    // FLAKINESS IS WORSE THAN NO TESTS, because people learn to ignore red.
    //
    // Two Partogram tests passed in isolation and failed in the full run: one
    // timed out, and one asserted an EMPTY request body — both symptoms of the
    // same cause. userEvent types character by character and yields between
    // keystrokes; with 21 jsdom environments competing for 12 cores those
    // yields were starved, so the click landed before React had the typed
    // state. Neither test is asserting speed, so the 5s default was measuring
    // the machine rather than the code.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Leave cores for the OS and for whatever else is running. A test run that
    // saturates the machine produces exactly the starvation above.
    // minThreads must be set too: it defaults to (cores - 1) and vitest throws
    // "minThreads and maxThreads must not conflict" if that exceeds the max.
    poolOptions: { threads: { minThreads: 1, maxThreads: 6 } },
  },
});
