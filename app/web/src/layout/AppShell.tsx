// AppShell: the primary application chrome.
// Permanent MUI Drawer sidebar (brand + grouped nav) on the left,
// AppBar topbar (real signed-in user + logout menu) on top, and an
// <Outlet /> for the routed page content.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import SpaIcon from "@mui/icons-material/Spa";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { navGroups, platformNavGroup, filterNav } from "./nav";
import { useAuth } from "../auth/AuthContext";
import FetchErrorBanner from '../components/FetchErrorBanner';

// Fixed sidebar width; shared between Drawer and content offset.
const DRAWER_WIDTH = 248;

function initials(email: string | null, role: string): string {
  if (email) return email.slice(0, 2).toUpperCase();
  return role.slice(0, 2).toUpperCase();
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, contexts, switchContext, logout } = useAuth();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [term, setTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const activeMembershipId = user?.membershipId ?? contexts.find((c) => c.isDefault)?.membershipId ?? '';

  // ⌘K / Ctrl+K focuses the global search — the affordance the placeholder promises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submitSearch = () => {
    const q = term.trim();
    if (!q) return;
    // Patient search is what exists today, so the box does exactly that —
    // the placeholder is scoped to match, not to promise invoice/appt search.
    navigate(`/patients?q=${encodeURIComponent(q)}`);
  };

  const handleContextChange = async (event: SelectChangeEvent<string>) => {
    const membershipId = event.target.value;
    if (!membershipId || membershipId === user?.membershipId) return;
    await switchContext(membershipId);
    navigate('/', { replace: true });
  };

  const handleLogout = () => {
    setAnchor(null);
    logout();
    navigate("/login", { replace: true });
  };

  const visibleNav = useMemo(() => {
    if (user?.isPlatformAdmin) return [platformNavGroup];
    const ent = user?.entitlements ?? new Set<string>();
    return filterNav(navGroups, ent, user?.role ?? null);
  }, [user?.entitlements, user?.isPlatformAdmin, user?.role]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* ---- Sidebar ---- */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "secondary.main",
            color: "common.white",
            borderRight: "none",
          },
        }}
      >
        {/* Brand block */}
        <Toolbar sx={{ px: 2.5, gap: 1.25 }}>
          <Avatar variant="rounded" sx={{ bgcolor: "primary.main", width: 34, height: 34 }}>
            <SpaIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Health OS
            </Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.6) }}>
              Summit Systems
            </Typography>
          </Box>
        </Toolbar>

        <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

        {/* Grouped nav */}
        <Box sx={{ overflowY: "auto", py: 1 }}>
          {visibleNav.map((group) => (
            <List
              key={group.label}
              dense
              subheader={
                <ListSubheader
                  disableSticky
                  sx={{
                    bgcolor: "transparent",
                    color: alpha("#fff", 0.45),
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    lineHeight: "32px",
                  }}
                >
                  {group.label}
                </ListSubheader>
              }
            >
              {group.items.map((item) => {
                const Icon = item.icon;
                // Exact match for '/', prefix match for the rest.
                const selected =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to);
                return (
                  <ListItemButton
                    key={item.to}
                    component={RouterLink}
                    to={item.to}
                    selected={selected}
                    sx={{
                      mx: 1.5,
                      my: 0.25,
                      borderRadius: 1.5,
                      color: alpha("#fff", 0.82),
                      "& .MuiListItemIcon-root": { color: "inherit", minWidth: 36 },
                      "&:hover": { bgcolor: alpha("#fff", 0.06) },
                      "&.Mui-selected": {
                        bgcolor: "primary.main",
                        color: "#fff",
                        "&:hover": { bgcolor: "primary.dark" },
                      },
                    }}
                  >
                    <ListItemIcon>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          ))}
        </Box>
      </Drawer>

      {/* ---- Main column ---- */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <AppBar
          position="sticky"
          elevation={0}
          color="inherit"
          sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
              {!user?.isPlatformAdmin && contexts.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 220, maxWidth: 320 }}>
                  <Select
                    value={activeMembershipId ?? ''}
                    onChange={handleContextChange}
                    displayEmpty
                  >
                    {contexts
                      .filter((c) => Boolean(c.membershipId))
                      .map((c) => (
                        <MenuItem key={c.membershipId!} value={c.membershipId!}>
                          {c.clinicName}
                          {c.branchName ? ` · ${c.branchName}` : ''}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              )}

              {/* Global search — scoped to patients, which is the search that
                  exists today. ⌘K focuses it; Enter runs it. */}
              {!user?.isPlatformAdmin && (
                <TextField
                  inputRef={searchRef}
                  size="small"
                  placeholder="Search patients…"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
                  sx={{ width: '100%', maxWidth: 420 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography
                          variant="caption"
                          sx={{
                            px: 0.75, py: 0.25, borderRadius: 1, border: 1,
                            borderColor: 'divider', color: 'text.secondary', whiteSpace: 'nowrap',
                          }}
                        >
                          ⌘K
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            </Box>

            {/* Notifications. No feed backend yet, so the bell carries no
                fabricated count — it opens an honest empty state. */}
            <Tooltip title="Notifications">
              <IconButton onClick={(e) => setNotifAnchor(e.currentTarget)}>
                <Badge color="error" variant="dot" invisible>
                  <NotificationsNoneIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={notifAnchor}
              open={Boolean(notifAnchor)}
              onClose={() => setNotifAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box sx={{ px: 2, py: 1.5, maxWidth: 280 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Notifications
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  You're all caught up. Alerts for stock, appointments, and
                  approvals will appear here once those feeds are wired.
                </Typography>
              </Box>
            </Menu>

            {/* Signed-in user + logout menu */}
            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {user?.email ?? "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.isPlatformAdmin ? "Platform admin" : user?.role}
              </Typography>
            </Box>
            <Avatar
              onClick={(e) => setAnchor(e.currentTarget)}
              sx={{ bgcolor: "primary.main", width: 36, height: 36, cursor: "pointer" }}
            >
              {initials(user?.email ?? null, user?.role ?? "")}
            </Avatar>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Sign out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Routed page content */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: "background.default" }}>
          {/* Above the page content, so a load failure cannot be mistaken for
              an empty result no matter what the page below renders. */}
          <FetchErrorBanner />
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
