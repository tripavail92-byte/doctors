import { SetMetadata } from '@nestjs/common';

/** Metadata key under which the required feature key is stored. */
export const ENTITLEMENT_KEY = 'entitlement';

/**
 * Require the tenant to have a given feature enabled.
 * Usage: @RequiresEntitlement('appointments.scheduling')
 */
export const RequiresEntitlement = (featureKey: string) =>
  SetMetadata(ENTITLEMENT_KEY, featureKey);