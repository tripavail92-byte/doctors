// IntegrationsPage: live provider status from GET /integrations/status.
// Shows whether WhatsApp / FBR / Telehealth run in live or stub mode.
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VideocamIcon from '@mui/icons-material/Videocam';
import type { SvgIconComponent } from '@mui/icons-material';
import { apiClient } from '../api/client';
import { useApi } from '../api/useApi';
import type { IntegrationsStatus } from '../api/types';

const META: Record<keyof IntegrationsStatus, { label: string; icon: SvgIconComponent; blurb: string }> = {
  whatsapp: { label: 'WhatsApp', icon: WhatsAppIcon, blurb: 'Meta Cloud API — reminders, receipts, campaigns' },
  fbr: { label: 'FBR e-Invoicing', icon: ReceiptLongIcon, blurb: 'Pakistan digital invoicing (IMS/PRAL)' },
  telehealth: { label: 'Telehealth', icon: VideocamIcon, blurb: 'LiveKit video consultations' },
};

export default function IntegrationsPage() {
  const { data, loading, error } = useApi<IntegrationsStatus>(() =>
    apiClient.get<IntegrationsStatus>('/integrations/status').then((r) => r.data),
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Integrations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Providers flip from <b>stub</b> to <b>live</b> automatically once real credentials are configured.
      </Typography>

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {data && (
        <Grid container spacing={2.5}>
          {(Object.keys(META) as (keyof IntegrationsStatus)[]).map((key) => {
            const meta = META[key];
            const Icon = meta.icon;
            const mode = data[key].mode;
            const live = mode === 'live';
            return (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                      <Box
                        sx={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: 'secondary.main',
                          color: '#fff',
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Chip
                        size="small"
                        label={mode.toUpperCase()}
                        color={live ? 'success' : 'default'}
                        variant={live ? 'filled' : 'outlined'}
                      />
                    </Stack>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {meta.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {meta.blurb}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      provider: {data[key].provider}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
