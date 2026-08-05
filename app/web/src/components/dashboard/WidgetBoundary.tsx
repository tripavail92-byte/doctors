/**
 * WidgetBoundary — a per-widget error boundary.
 *
 * A dashboard is a lot of widgets in one page. One widget crashing must
 * not take down the other eight. React's default behaviour is to let a
 * thrown render error unmount the whole tree; caught by the router's
 * error boundary, we see "Unexpected Application Error" and nothing else.
 *
 * The rule this enforces: the ONLY thing a widget crash affects on
 * screen is that widget. The banner and every other widget still work.
 *
 * This is a real production incident, not a hypothesis — the first live
 * dashboard render crashed the whole page because /platform/tenants
 * returned a legacy shape and the pagination code read .rows.length on
 * undefined. With this boundary in place, that same crash prints one
 * apologetic card in one grid cell and the rest of the page renders.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertTitle, Card, CardContent, Typography } from '@mui/material';

interface Props {
  /** Short label used in the fallback card. Names the widget the reader lost. */
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class WidgetBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface in the browser console so a developer can find it fast.
    // The card below is the user-visible half; this is the audit trail.
    // eslint-disable-next-line no-console
    console.error(`[widget:${this.props.label}]`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 3, height: '100%' }}>
          <CardContent>
            <Alert severity="error" sx={{ mb: 1 }}>
              <AlertTitle>{this.props.label} could not be shown</AlertTitle>
              A rendering error was caught here. The rest of the dashboard is
              unaffected. Ask an admin to check the developer console for a
              <code style={{ margin: '0 4px' }}>[widget:{this.props.label}]</code>
              log line.
            </Alert>
            <Typography variant="caption" color="text.secondary">
              {this.state.error.message}
            </Typography>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
