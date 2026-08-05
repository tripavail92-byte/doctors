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
if (import.meta.env.VITE_STUB_API === '1') {
  // Dynamic import so the stub module is not in the production bundle.
  import('./dev/stubs').then((m) => m.installDevStubs());
}

// Application entry point.
// AuthProvider (session state) wraps the router; the MUI ThemeProvider
// (default teal edition theme) + CssBaseline give a consistent baseline.
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
