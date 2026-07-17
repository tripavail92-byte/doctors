import { PackManifest } from '../manifest.types';
import { aestheticManifest } from './aesthetic.manifest';
import { dermatologyManifest } from './dermatology.manifest';
import { dentalManifest } from './dental.manifest';
import { obgynManifest } from './obgyn.manifest';
import { ophthalmologyManifest } from './ophthalmology.manifest';
import { physiotherapyManifest } from './physiotherapy.manifest';

// The packs registered into the platform catalog at boot (PacksService).
// Wave A ships these HEAVY packs; more are added by dropping a manifest
// here (Light packs) or here + a widget screen (Heavy packs).
export const BUILTIN_MANIFESTS: PackManifest[] = [
  aestheticManifest,
  dermatologyManifest,
  dentalManifest,
  obgynManifest,
  ophthalmologyManifest,
  physiotherapyManifest,
];
