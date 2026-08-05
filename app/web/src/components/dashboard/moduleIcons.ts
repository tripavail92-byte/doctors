/**
 * Client-side icon lookup for module tiles.
 *
 * Icons stay off the wire — the API returns keys, the client picks an icon.
 * Falls back to a generic tile icon for keys not yet in the map, so the
 * dashboard renders even when the backend returns something new.
 */
import type { SvgIconComponent } from '@mui/icons-material';
import CalendarMonthIcon    from '@mui/icons-material/CalendarMonth';
import PeopleIcon           from '@mui/icons-material/People';
import ReceiptLongIcon      from '@mui/icons-material/ReceiptLong';
import MedicalInformationIcon from '@mui/icons-material/MedicalInformation';
import Inventory2Icon       from '@mui/icons-material/Inventory2';
import BarChartIcon         from '@mui/icons-material/BarChart';
import VideocamIcon         from '@mui/icons-material/Videocam';
import CampaignIcon         from '@mui/icons-material/Campaign';
import ScienceIcon          from '@mui/icons-material/Science';
import LocalPharmacyIcon    from '@mui/icons-material/LocalPharmacy';
import HotelIcon            from '@mui/icons-material/Hotel';
import PaymentsIcon         from '@mui/icons-material/Payments';
import HubIcon              from '@mui/icons-material/Hub';
import BiotechIcon          from '@mui/icons-material/Biotech';
import GridViewIcon         from '@mui/icons-material/GridView';
import MedicationLiquidIcon from '@mui/icons-material/MedicationLiquid';
import ChildCareIcon        from '@mui/icons-material/ChildCare';
import VisibilityIcon       from '@mui/icons-material/Visibility';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import PregnantWomanIcon    from '@mui/icons-material/PregnantWoman';
import VaccinesIcon         from '@mui/icons-material/Vaccines';

const MAP: Record<string, SvgIconComponent> = {
  'appointments.core':  CalendarMonthIcon,
  'patients.core':      PeopleIcon,
  'billing.core':       ReceiptLongIcon,
  'emr.core':           MedicalInformationIcon,
  'pharmacy.core':      LocalPharmacyIcon,
  'reporting.core':     BarChartIcon,
  'integrations.core':  VideocamIcon,
  'crm.core':           CampaignIcon,
  'lab.core':           ScienceIcon,
  'imaging.core':       BiotechIcon,
  'ipd.core':           HotelIcon,
  'hr.core':            PaymentsIcon,
  'multibranch.core':   HubIcon,
  'media.core':         MedicalInformationIcon,
  'observations.core':  BarChartIcon,
  'catalog.core':       Inventory2Icon,
  'instruments.core':   BarChartIcon,
  'packs.core':         GridViewIcon,
  'pack.dental':        MedicationLiquidIcon,
  'pack.dermatology':   AccessibilityNewIcon,
  'pack.pediatrics':    ChildCareIcon,
  'pack.ophthalmology': VisibilityIcon,
  'pack.physiotherapy': AccessibilityNewIcon,
  'pack.obgyn':         PregnantWomanIcon,
  'pack.aesthetic':     AccessibilityNewIcon,
  'growth.core':        ChildCareIcon,
  'dosing.core':        VaccinesIcon,
  'immunization.core':  VaccinesIcon,
};

export function iconForModule(key: string): SvgIconComponent {
  return MAP[key] ?? GridViewIcon;
}
