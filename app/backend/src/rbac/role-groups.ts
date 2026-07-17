import { UserRole } from '@prisma/client';

// Named role groups so @Roles(...) lists don't drift across controllers.
export const CLINICAL_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.DOCTOR,
  UserRole.TREATMENT,
  UserRole.RECEPTION,
];

export const PRESCRIBER_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.DOCTOR,
  UserRole.TREATMENT,
];

export const FRONT_DESK_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.RECEPTION,
  UserRole.DOCTOR,
];

export const FINANCE_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.FINANCE,
  UserRole.RECEPTION,
];

export const PHARMACY_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.INVENTORY,
  UserRole.RECEPTION,
  UserRole.DOCTOR,
];
