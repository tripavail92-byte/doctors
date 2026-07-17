import { BodySideName, sideLabel } from '../observations/laterality';

/** Anatomical context drives the label: OD/OS for eyes, AD/AS for ears, L/R otherwise. */
export type SideContext = 'eye' | 'ear' | undefined;

// Bilateral pricing expansion.
//
// A bilateral procedure is TWO procedures and must bill as two lines — unless
// the clinic sells a bundled both-sides price. Collapsing it into one line at
// the unit price silently halves the revenue; charging 2x when a bundle exists
// overcharges the patient. Neither is recoverable after the fact, so the
// decision is made here, once, from the catalog item's own configuration.
//
// Splitting into per-side lines also makes the invoice legible to the patient
// and to FBR: "Tonometry (OD)" and "Tonometry (OS)" say what was done.

export interface LineSeed {
  code: string;
  name: string;
  unitPricePkr: number;
  quantity?: number;
  side?: BodySideName | null;
  /** From ServiceCatalogItem: is this procedure per-side at all? */
  lateralizable?: boolean;
  /** Bundled price for BOTH sides. Null/absent => bill 2 x unitPricePkr. */
  bilateralPricePkr?: number | null;
  /** Anatomical context for the label (eye -> OD/OS, ear -> AD/AS).*/
  sideContext?: SideContext;
}

export interface ExpandedLine {
  code: string;
  name: string;
  unitPricePkr: number;
  quantity: number;
  side: BodySideName | null;
}

/**
 * Expand one requested item into the line(s) that should actually be billed.
 *
 * - no side, or not lateralizable  -> unchanged, one line, side null
 * - LEFT / RIGHT                   -> one line, labelled, side recorded
 * - BILATERAL + bundle price       -> one line at the bundle price
 * - BILATERAL, no bundle price     -> TWO lines, one per side, unit price each
 */
export function expandLaterality(seed: LineSeed): ExpandedLine[] {
  const quantity = seed.quantity ?? 1;
  const side = seed.side ?? null;

  // A side on a non-lateralizable item is meaningless (a consultation has no
  // left and right). Drop it rather than record a side nothing can act on.
  if (!side || !seed.lateralizable) {
    return [
      { code: seed.code, name: seed.name, unitPricePkr: seed.unitPricePkr, quantity, side: null },
    ];
  }

  if (side !== 'BILATERAL') {
    return [
      {
        code: seed.code,
        name: `${seed.name} (${sideLabel(side, seed.sideContext)})`,
        unitPricePkr: seed.unitPricePkr,
        quantity,
        side,
      },
    ];
  }

  if (seed.bilateralPricePkr != null) {
    return [
      {
        code: seed.code,
        name: `${seed.name} (bilateral)`,
        unitPricePkr: seed.bilateralPricePkr,
        quantity,
        side: 'BILATERAL',
      },
    ];
  }

  // No bundle price: two sides, two lines, full price each.
  return (['RIGHT', 'LEFT'] as BodySideName[]).map((s) => ({
    code: seed.code,
    name: `${seed.name} (${sideLabel(s, seed.sideContext)})`,
    unitPricePkr: seed.unitPricePkr,
    quantity,
    side: s,
  }));
}
