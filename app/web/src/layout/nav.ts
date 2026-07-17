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

// A single clickable nav entry.
export interface NavItem {
  label: string;
  // Route path this item links to (React Router).
  to: string;
  // MUI icon component rendered at the start of the row.
  icon: SvgIconComponent;
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
      { label: "Dental chart", to: "/dental", icon: MedicationLiquidIcon },
      { label: "Growth chart", to: "/growth", icon: ChildCareIcon },
      { label: "Dose calculator", to: "/dose", icon: VaccinesIcon },
      { label: "ANC card", to: "/anc", icon: PregnantWomanIcon },
      { label: "Partogram", to: "/partogram", icon: MonitorHeartIcon },
      { label: "Severity grading", to: "/grading", icon: RuleIcon },
      { label: "Phototherapy", to: "/phototherapy", icon: WbIridescentIcon },
      { label: "Immunization", to: "/immunization", icon: VaccinesOutlinedIcon },
      { label: "Laboratory", to: "/lab", icon: ScienceIcon },
      { label: "Inpatient", to: "/ipd", icon: HotelIcon },
      { label: "Eye exam", to: "/ophthalmology", icon: VisibilityIcon },
      { label: "Physiotherapy", to: "/rehab", icon: AccessibilityNewIcon },
      { label: "Trends", to: "/trends", icon: ShowChartIcon },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Billing", to: "/billing", icon: ReceiptLongIcon },
      { label: "Pharmacy", to: "/pharmacy", icon: LocalPharmacyIcon },
      { label: "Payroll", to: "/payroll", icon: PaymentsIcon },
      { label: "Leads", to: "/leads", icon: CampaignIcon },
      { label: "Reports", to: "/reports", icon: BarChartIcon },
      { label: "Integrations", to: "/integrations", icon: HubIcon },
    ],
  },
];
