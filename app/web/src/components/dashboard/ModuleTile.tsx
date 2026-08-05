/**
 * ModuleTile — one cell in the "Popular Modules" 4×2 grid.
 *
 * Icon (bg-tinted square) + label + activeClinics count + "Active Clinics"
 * hint. Icon choice is client-side, keyed by the module's stable string
 * key (see moduleIcons.ts); this keeps icon revs off the wire.
 */
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import { iconForModule } from './moduleIcons';

export interface ModuleTileProps {
  moduleKey: string;
  label: string;
  activeClinics: number;
  /** Optional icon override; defaults to the moduleIcons.ts map. */
  icon?: SvgIconComponent;
  /** Colour hue for the icon tile. Rotated per position for visual variety. */
  hue?: 'blue' | 'green' | 'violet' | 'amber' | 'teal' | 'pink';
}

const HUE_TOKENS: Record<NonNullable<ModuleTileProps['hue']>, string> = {
  blue:   '#3B82F6',
  green:  '#10B981',
  violet: '#8B5CF6',
  amber:  '#F59E0B',
  teal:   '#0F766E',
  pink:   '#EC4899',
};

export default function ModuleTile({ moduleKey, label, activeClinics, icon, hue = 'blue' }: ModuleTileProps) {
  const theme = useTheme();
  const Icon = icon ?? iconForModule(moduleKey);
  const color = HUE_TOKENS[hue];

  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.24 : 0.14),
              color,
              flexShrink: 0,
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {activeClinics.toLocaleString('en-PK')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active Clinics
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
