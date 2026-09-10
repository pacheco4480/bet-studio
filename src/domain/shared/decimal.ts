const decimalPattern = /^(0|[1-9]\d*)(\.\d{1,4})?$/;

export type DecimalString = string & { readonly __brand: 'DecimalString' };

export function parseDecimalString(value: string): DecimalString {
  if (!decimalPattern.test(value) || Number(value) <= 0) {
    throw new Error('Decimal value must be a positive decimal string');
  }

  return value as DecimalString;
}
