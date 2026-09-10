export type UtcDateString = string & { readonly __brand: 'UtcDateString' };

export function toUtcDateString(date: Date): UtcDateString {
  return date.toISOString() as UtcDateString;
}

export function nowUtc(): UtcDateString {
  return toUtcDateString(new Date());
}
