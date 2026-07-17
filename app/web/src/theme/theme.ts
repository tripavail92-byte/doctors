import { createTheme, type Theme } from '@mui/material/styles';
import { palette, editionAccents, fonts, type Edition } from './tokens';

// Builds the MUI theme from the design tokens.
// Pass an `edition` to swap the accent (secondary-tinted highlight) color;
// defaults to the base gold accent when omitted.
export function buildTheme(edition: Edition = 'default'): Theme {
  const accent = editionAccents[edition];

  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: palette.primary },
      secondary: { main: palette.secondary },
      // Gold/edition accent surfaced through the `warning` slot so it is
      // reachable via standard MUI color props.
      warning: { main: accent },
      background: {
        default: palette.background,
        paper: palette.paper,
      },
      text: {
        primary: palette.textPrimary,
        secondary: palette.textSecondary,
      },
      divider: palette.divider,
    },
    typography: {
      fontFamily: fonts.body,
      h1: { fontFamily: fonts.heading, fontWeight: 600 },
      h2: { fontFamily: fonts.heading, fontWeight: 600 },
      h3: { fontFamily: fonts.heading, fontWeight: 600 },
      h4: { fontFamily: fonts.heading, fontWeight: 600 },
      h5: { fontFamily: fonts.heading, fontWeight: 600 },
      h6: { fontFamily: fonts.heading, fontWeight: 600 },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'default' },
      },
    },
  });
}