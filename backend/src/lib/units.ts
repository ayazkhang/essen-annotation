export type MeasurementUnit =
  | 'g'
  | 'mg'
  | 'ug'
  | 'kg'
  | 'ml'
  | 'l'
  | 'mmHg'
  | 'IE'
  | 'mm'
  | 'cm'
  | 'Ch';

export const MEASUREMENT_UNITS: MeasurementUnit[] = [
  'g',
  'mg',
  'ug',
  'kg',
  'ml',
  'l',
  'mmHg',
  'IE',
  'mm',
  'cm',
  'Ch',
];

export interface NormalizedMeasurement {
  value: number;
  unit: MeasurementUnit;
  /** Value expressed in the base unit for its dimension */
  normalizedValue: number;
  /** Base unit for the dimension (g for mass, l for volume, cm for length, identity otherwise) */
  baseUnit: 'g' | 'l' | 'cm' | 'mmHg' | 'IE' | 'Ch';
}

const MASS_TO_G: Partial<Record<MeasurementUnit, number>> = {
  g: 1,
  mg: 0.001,
  ug: 0.000001,
  kg: 1000,
};

const VOLUME_TO_L: Partial<Record<MeasurementUnit, number>> = {
  l: 1,
  ml: 0.001,
};

const LENGTH_TO_CM: Partial<Record<MeasurementUnit, number>> = {
  cm: 1,
  mm: 0.1,
};

/**
 * Normalize a measurement to a stable base unit for export / training.
 * mmHg, IE, and Ch are left as identity (no safe conversion without clinical context).
 */
export function normalizeMeasurement(value: number, unit: MeasurementUnit): NormalizedMeasurement {
  if (!Number.isFinite(value)) {
    throw new Error(`Measurement value must be finite, got ${value}`);
  }
  if (!MEASUREMENT_UNITS.includes(unit)) {
    throw new Error(`Unsupported unit: ${unit}`);
  }

  if (unit in MASS_TO_G) {
    return {
      value,
      unit,
      normalizedValue: value * (MASS_TO_G[unit] as number),
      baseUnit: 'g',
    };
  }
  if (unit in VOLUME_TO_L) {
    return {
      value,
      unit,
      normalizedValue: value * (VOLUME_TO_L[unit] as number),
      baseUnit: 'l',
    };
  }
  if (unit in LENGTH_TO_CM) {
    return {
      value,
      unit,
      normalizedValue: value * (LENGTH_TO_CM[unit] as number),
      baseUnit: 'cm',
    };
  }

  // Identity dimensions
  const baseUnit = unit as 'mmHg' | 'IE' | 'Ch';
  return { value, unit, normalizedValue: value, baseUnit };
}
