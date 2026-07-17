// AppShell: the primary application chrome.
// Permanent MUI Drawer sidebar (brand + grouped nav) on the left,
// AppBar topbar (real signed-in user + logout menu) on top, and an
// <Outlet /> for the routed page content.
import { useState } from "react";
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  alpha,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import SpaIcon from "@mui/icons-material/Spa";
import { navGroups } from "./nav";
import { useAuth } from "../auth/AuthContext";

// Fixed sidebar width; shared between Drawer and content offset.
const DRAWER_WIDTH = 248;

function initials(email: string | null, role: string): string {
  if (email) return email.slice(0, 2).toUpperCase();
  return role.slice(0, 2).toUpperCase();
}

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    setAnchor(null);
    logout();
    navigate("/login", { replace: true });
  };

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
          {navGroups.map((group) => (
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
            <Box sx={{ flexGrow: 1 }} />

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
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
