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
  requires?: string[];
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
      { label: "Billing", to: "/billing", icon: ReceiptLongIcon },
      { label: "Pharmacy", to: "/pharmacy", icon: LocalPharmacyIcon, requires: ["pharmacy.core"] },
      { label: "Payroll", to: "/payroll", icon: PaymentsIcon, requires: ["hr.core"] },
      { label: "Leads", to: "/leads", icon: CampaignIcon, requires: ["crm.core"] },
      { label: "Reports", to: "/reports", icon: BarChartIcon, requires: ["reporting.core"] },
      { label: "Integrations", to: "/integrations", icon: HubIcon, requires: ["integrations.core"] },
    ],
  },
];

/** Filter nav groups to only items the tenant's entitlements allow. */
export function filterNav(groups: NavGroup[], entitlements: Set<string>): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) => !item.requires || item.requires.every((k) => entitlements.has(k)),
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export const platformNavGroup: NavGroup = {
  label: "Platform",
  items: [
    { label: "Clinics", to: "/admin/tenants", icon: AdminPanelSettingsIcon },
  ],
};
