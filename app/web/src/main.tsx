import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { RouterProvider } from 'react-router-dom';
import { router } from './App';
import { buildTheme } from './theme/theme';
import { AuthProvider } from './auth/AuthContext';

// Dev-time stubs: swap axios's adapter so certain endpoints return
// contract-shaped bodies without a running backend. Every stubbed route has
// a Markdown contract at docs/contracts/ and a TypeScript type at
// src/api/contracts/. Off by default; enable with `VITE_STUB_API=1` when
// starting Vite. Unstubbed requests still hit the real API.
//
// The install MUST complete before React first renders — otherwise a page
// that fires its useApi calls on first mount (like ClinicOpsDashboardPage
// hit via a direct URL) races the dynamic import and gets 500s back
// through the /api proxy before the adapter is in place. Landing on /login
// masks it because auth completes before any dashboard call, but reload on
// a data page shows the race.
async function bootstrap() {
  if (import.meta.env.VITE_STUB_API === '1') {
    const m = await import('./dev/stubs');
    m.installDevStubs();
  }

  const theme = buildTheme();
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
}

bootstrap();
