import { parseDecimalString, type DecimalString } from '../shared/decimal.js';
import type { BulletinType } from './types.js';

export function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

export function assertNonNegativeInteger(
  value: number | null,
  fieldName: string,
): void {
  if (value !== null && (!Number.isInteger(value) || value < 0)) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
}

export function assertDifferentTeams(
  homeTeamId: string,
  awayTeamId: string,
): void {
  if (homeTeamId === awayTeamId) {
    throw new Error('A fixture must have different home and away teams');
  }
}

export function assertSelectionCount(type: BulletinType, count: number): void {
  if (type === 'SINGLE' && count !== 1) {
    throw new Error('SINGLE bulletins must contain exactly one selection');
  }

  if (type === 'MULTI' && (count < 2 || count > 10)) {
    throw new Error('MULTI bulletins must contain between 2 and 10 selections');
  }
}

export function toOdd(value: string): DecimalString {
  return parseDecimalString(value);
}
