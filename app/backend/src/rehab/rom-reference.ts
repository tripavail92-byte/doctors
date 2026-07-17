// Range-of-motion normal reference (degrees). Reference/starter values in the
// commonly-taught AAOS range; a deployment may override per protocol.

export interface RomRef {
  joint: string;
  movement: string;
  normalDegrees: number;
  /** Hard data-entry ceiling (a little above normal to allow hypermobility). */
  maxDegrees: number;
}

export const ROM_REFERENCE: RomRef[] = [
  // Cervical
  { joint: 'CERVICAL', movement: 'FLEXION', normalDegrees: 45, maxDegrees: 70 },
  { joint: 'CERVICAL', movement: 'EXTENSION', normalDegrees: 45, maxDegrees: 70 },
  { joint: 'CERVICAL', movement: 'LATERAL_FLEXION', normalDegrees: 45, maxDegrees: 60 },
  { joint: 'CERVICAL', movement: 'ROTATION', normalDegrees: 60, maxDegrees: 90 },
  // Lumbar
  { joint: 'LUMBAR', movement: 'FLEXION', normalDegrees: 60, maxDegrees: 90 },
  { joint: 'LUMBAR', movement: 'EXTENSION', normalDegrees: 25, maxDegrees: 40 },
  { joint: 'LUMBAR', movement: 'LATERAL_FLEXION', normalDegrees: 25, maxDegrees: 40 },
  { joint: 'LUMBAR', movement: 'ROTATION', normalDegrees: 30, maxDegrees: 45 },
  // Shoulder
  { joint: 'SHOULDER', movement: 'FLEXION', normalDegrees: 180, maxDegrees: 190 },
  { joint: 'SHOULDER', movement: 'EXTENSION', normalDegrees: 60, maxDegrees: 80 },
  { joint: 'SHOULDER', movement: 'ABDUCTION', normalDegrees: 180, maxDegrees: 190 },
  { joint: 'SHOULDER', movement: 'INTERNAL_ROTATION', normalDegrees: 70, maxDegrees: 90 },
  { joint: 'SHOULDER', movement: 'EXTERNAL_ROTATION', normalDegrees: 90, maxDegrees: 100 },
  // Elbow / forearm
  { joint: 'ELBOW', movement: 'FLEXION', normalDegrees: 150, maxDegrees: 160 },
  { joint: 'ELBOW', movement: 'EXTENSION', normalDegrees: 0, maxDegrees: 15 },
  { joint: 'FOREARM', movement: 'SUPINATION', normalDegrees: 80, maxDegrees: 90 },
  { joint: 'FOREARM', movement: 'PRONATION', normalDegrees: 80, maxDegrees: 90 },
  // Wrist
  { joint: 'WRIST', movement: 'FLEXION', normalDegrees: 80, maxDegrees: 90 },
  { joint: 'WRIST', movement: 'EXTENSION', normalDegrees: 70, maxDegrees: 90 },
  // Hip
  { joint: 'HIP', movement: 'FLEXION', normalDegrees: 120, maxDegrees: 135 },
  { joint: 'HIP', movement: 'EXTENSION', normalDegrees: 30, maxDegrees: 45 },
  { joint: 'HIP', movement: 'ABDUCTION', normalDegrees: 45, maxDegrees: 60 },
  { joint: 'HIP', movement: 'ADDUCTION', normalDegrees: 30, maxDegrees: 40 },
  { joint: 'HIP', movement: 'INTERNAL_ROTATION', normalDegrees: 45, maxDegrees: 60 },
  { joint: 'HIP', movement: 'EXTERNAL_ROTATION', normalDegrees: 45, maxDegrees: 60 },
  // Knee
  { joint: 'KNEE', movement: 'FLEXION', normalDegrees: 135, maxDegrees: 150 },
  { joint: 'KNEE', movement: 'EXTENSION', normalDegrees: 0, maxDegrees: 15 },
  // Ankle
  { joint: 'ANKLE', movement: 'DORSIFLEXION', normalDegrees: 20, maxDegrees: 30 },
  { joint: 'ANKLE', movement: 'PLANTARFLEXION', normalDegrees: 50, maxDegrees: 60 },
  { joint: 'ANKLE', movement: 'INVERSION', normalDegrees: 35, maxDegrees: 45 },
  { joint: 'ANKLE', movement: 'EVERSION', normalDegrees: 15, maxDegrees: 25 },
];

const KEY = (j: string, m: string) => `${j}|${m}`;
const BY_KEY = new Map(ROM_REFERENCE.map((r) => [KEY(r.joint, r.movement), r]));

export const romRef = (joint: string, movement: string): RomRef | undefined =>
  BY_KEY.get(KEY(joint, movement));

export const JOINTS = [...new Set(ROM_REFERENCE.map((r) => r.joint))];
