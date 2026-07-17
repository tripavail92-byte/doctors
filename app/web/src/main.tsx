import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { RouterProvider } from 'react-router-dom';
import { router } from './App';
import { buildTheme } from './theme/theme';
import { AuthProvider } from './auth/AuthContext';

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
