// Grouped navigation model for the AppShell sidebar.
// Each group has a label and a list of items; each item maps to a route.
// Only routes that are actually implemented against the API are listed here
// (see App.tsx). Icons are referenced by MUI icon component so AppShell can
// render them.
import type { SvgIconComponent } from "@mui/icons-material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import BarChartIcon from "@mui/icons-material/BarChart";
import HubIcon from "@mui/icons-material/Hub";
import MedicationLiquidIcon from "@mui/icons-material/MedicationLiquid";
import ChildCareIcon from "@mui/icons-material/ChildCare";
import VaccinesIcon from "@mui/icons-material/Vaccines";
import PregnantWomanIcon from "@mui/icons-material/PregnantWoman";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import WbIridescentIcon from "@mui/icons-material/WbIridescent";
import RuleIcon from "@mui/icons-material/Rule";
import VaccinesOutlinedIcon from "@mui/icons-material/VaccinesOutlined";
import ScienceIcon from "@mui/icons-material/Science";
import HotelIcon from "@mui/icons-material/Hotel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import PaymentsIcon from "@mui/icons-material/Payments";
import CampaignIcon from "@mui/icons-material/Campaign";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

// A single clickable nav entry.
export interface NavItem {
  label: string;
  // Route path this item links to (React Router).
  to: string;
  // MUI icon component rendered at the start of the row.
  icon: SvgIconComponent;
  // If set, the item is hidden unless the tenant has ALL of these feature keys.
  // Entitlements are a plan-boundary concern — "this clinic bought that module".
  requires?: string[];
  // If set, the item is hidden unless the signed-in user's role is in the list.
  // Roles are a permissions concern — "this staff member is allowed to see it".
  // filterNav requires BOTH; a DOCTOR seeing Payroll and 403ing on click, then
  // being told "your clinic hasn't paid for this", is what this field prevents.
  roles?: string[];
}

// A labelled group of nav items rendered as a section in the drawer.
export interface NavGroup {
  label: string;
  items: NavItem[];
}

// The full grouped nav used by the sidebar.
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", to: "/", icon: DashboardIcon }],
  },
  {
    label: "Clinical",
    items: [
      { label: "Patients", to: "/patients", icon: PeopleIcon },
      { label: "Dental chart", to: "/dental", icon: MedicationLiquidIcon, requires: ["pack.dental"] },
      { label: "Growth chart", to: "/growth", icon: ChildCareIcon, requires: ["growth.core"] },
      { label: "Dose calculator", to: "/dose", icon: VaccinesIcon, requires: ["dosing.core"] },
      { label: "ANC card", to: "/anc", icon: PregnantWomanIcon, requires: ["pack.obgyn"] },
      { label: "Partogram", to: "/partogram", icon: MonitorHeartIcon, requires: ["pack.obgyn"] },
      { label: "Severity grading", to: "/grading", icon: RuleIcon, requires: ["pack.dermatology"] },
      { label: "Phototherapy", to: "/phototherapy", icon: WbIridescentIcon, requires: ["pack.dermatology"] },
      { label: "Immunization", to: "/immunization", icon: VaccinesOutlinedIcon, requires: ["immunization.core"] },
      { label: "Laboratory", to: "/lab", icon: ScienceIcon, requires: ["lab.core"] },
      { label: "Inpatient", to: "/ipd", icon: HotelIcon, requires: ["ipd.core"] },
      { label: "Eye exam", to: "/ophthalmology", icon: VisibilityIcon, requires: ["pack.ophthalmology"] },
      { label: "Physiotherapy", to: "/rehab", icon: AccessibilityNewIcon, requires: ["pack.physiotherapy"] },
      { label: "Trends", to: "/trends", icon: ShowChartIcon },
    ],
  },
  {
    label: "Business",
    items: [
      // Roles are business-tier: guards enforce the same list on the server
      // (auth/decorators/roles.decorator.ts callers in billing/hr/reports/crm).
      // The nav mirror is exclusively so the item does not APPEAR to someone
      // who cannot click it — the security answer is the server-side guard.
      { label: "Billing", to: "/billing", icon: ReceiptLongIcon,
        roles: ["OWNER", "ADMIN", "FINANCE", "RECEPTION"] },
      { label: "Pharmacy", to: "/pharmacy", icon: LocalPharmacyIcon, requires: ["pharmacy.core"],
        roles: ["OWNER", "ADMIN", "INVENTORY", "RECEPTION"] },
      { label: "Payroll", to: "/payroll", icon: PaymentsIcon, requires: ["hr.core"],
        roles: ["OWNER", "ADMIN", "FINANCE"] },
      { label: "Leads", to: "/leads", icon: CampaignIcon, requires: ["crm.core"],
        roles: ["OWNER", "ADMIN", "SALES", "RECEPTION"] },
      { label: "Reports", to: "/reports", icon: BarChartIcon, requires: ["reporting.core"],
        roles: ["OWNER", "ADMIN", "FINANCE"] },
      { label: "Integrations", to: "/integrations", icon: HubIcon, requires: ["integrations.core"],
        roles: ["OWNER", "ADMIN"] },
    ],
  },
];

/**
 * Filter nav groups to items the current user can actually reach — both
 * plan-boundary (entitlements) AND permissions (role). Removing either
 * dimension is a real defect the app has already shipped:
 *
 *   - filter on entitlements only: a DOCTOR sees Reports/Payroll/Billing,
 *     clicks, gets a 403, and the banner tells them the clinic hasn't paid.
 *   - filter on role only: shipping the item to a tenant whose plan does not
 *     include it, where the click is a "Not included in your plan" toast
 *     for a feature nobody promised.
 *
 * Both filters are AND. A group with no surviving items disappears.
 */
export function filterNav(
  groups: NavGroup[],
  entitlements: Set<string>,
  role: string | null | undefined,
): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.requires && !item.requires.every((k) => entitlements.has(k))) return false;
        if (item.roles && (!role || !item.roles.includes(role))) return false;
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);
}

export const platformNavGroup: NavGroup = {
  label: "Platform",
  items: [
    { label: "Clinics", to: "/admin/tenants", icon: AdminPanelSettingsIcon },
  ],
};
