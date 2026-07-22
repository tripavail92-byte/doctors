import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import SpaIcon from '@mui/icons-material/Spa';
import axios from 'axios';
import { useAuth } from '../auth/AuthContext';

interface LocationState {
  from?: { pathname: string };
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  // Prefilled ONLY in development. import.meta.env.DEV is false in `vite build`,
  // so the deployed bundle ships an empty form — a login screen that fills in a
  // password for you is a login screen that tells everyone the password.
  const [email, setEmail] = useState(import.meta.env.DEV ? 'owner@glowderma.pk' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'Password123!' : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.status === 401
          ? 'Invalid email or password.'
          : 'Sign-in failed. Is the API running?';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background: (t) =>
          `linear-gradient(135deg, ${t.palette.secondary.main} 0%, ${t.palette.primary.main} 100%)`,
      }}
    >
      <Card elevation={8} sx={{ width: '100%', maxWidth: 400, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
            <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
              <SpaIcon />
            </Avatar>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Health OS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Summit Systems · sign in
              </Typography>
            </Box>
          </Stack>

          <form onSubmit={submit}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                fullWidth
                required
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
              />
              <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </form>

          {/* Development only. This printed "Demo: owner@glowderma.pk ·
              Password123!" on every login screen INCLUDING the deployed one —
              publishing working credentials for a clinic system to anyone who
              loaded the page, and staying on screen after the seed password was
              changed, so it was also simply wrong. A convenience for local work
              is not a thing to ship. */}
          {import.meta.env.DEV && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 2, textAlign: 'center', bgcolor: (t) => alpha(t.palette.text.primary, 0.03), py: 1, borderRadius: 1 }}
            >
              Dev only: owner@glowderma.pk · Password123!
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
