import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import { RequireAuth } from './auth/RequireAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import DentalPage from './pages/DentalPage';
import GrowthChartPage from './pages/GrowthChartPage';
import DoseCalculatorPage from './pages/DoseCalculatorPage';
import AncCardPage from './pages/AncCardPage';
import PartogramPage from './pages/PartogramPage';
import ReportsPage from './pages/ReportsPage';
import IntegrationsPage from './pages/IntegrationsPage';

// Application route tree.
// /login is public; everything under '/' is wrapped in RequireAuth and rendered
// inside AppShell (permanent Drawer sidebar + AppBar topbar) via <Outlet />.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'patients', element: <PatientsPage /> },
      { path: 'dental', element: <DentalPage /> },
      { path: 'growth', element: <GrowthChartPage /> },
      { path: 'dose', element: <DoseCalculatorPage /> },
      { path: 'anc', element: <AncCardPage /> },
      { path: 'partogram', element: <PartogramPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'integrations', element: <IntegrationsPage /> },
      // Unknown paths fall back to the dashboard.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
