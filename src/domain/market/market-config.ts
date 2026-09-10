import { z } from 'zod';

const supportedTotalGoalLines = [0.5, 1.5, 2.5, 3.5, 4.5] as const;
const supportedCornerLines = [7.5, 8.5, 9.5, 10.5, 11.5] as const;
const primitiveEvaluatorKeys = [
  'MATCH_RESULT',
  'TOTAL_GOALS',
  'DOUBLE_CHANCE',
  'BTTS',
  'TOTAL_CORNERS',
] as const;

export const marketCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9_]+$/, 'Market code must use A-Z, 0-9 and underscores only');

const matchResultParameters = z.object({
  result: z.enum(['HOME', 'DRAW', 'AWAY']),
});

const totalGoalsParameters = z.object({
  direction: z.enum(['OVER', 'UNDER']),
  line: z
    .number()
    .refine((line) => supportedTotalGoalLines.includes(line as never), {
      message: 'Unsupported goal line',
    }),
});

const doubleChanceParameters = z.object({
  outcome: z.enum(['1X', 'X2', '12']),
});

const bttsParameters = z.object({
  selection: z.enum(['YES', 'NO']),
});

const totalCornersParameters = z.object({
  direction: z.enum(['OVER', 'UNDER']),
  line: z
    .number()
    .refine((line) => supportedCornerLines.includes(line as never), {
      message: 'Unsupported corner line',
    }),
});

const primitiveCondition = z.discriminatedUnion('evaluatorKey', [
  z.object({
    evaluatorKey: z.literal('MATCH_RESULT'),
    parameters: matchResultParameters,
  }),
  z.object({
    evaluatorKey: z.literal('TOTAL_GOALS'),
    parameters: totalGoalsParameters,
  }),
  z.object({
    evaluatorKey: z.literal('DOUBLE_CHANCE'),
    parameters: doubleChanceParameters,
  }),
  z.object({ evaluatorKey: z.literal('BTTS'), parameters: bttsParameters }),
  z.object({
    evaluatorKey: z.literal('TOTAL_CORNERS'),
    parameters: totalCornersParameters,
  }),
]);

const compositeParameters = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(primitiveCondition).min(2).max(4),
});

export const autoMarketConfigSchema = z.discriminatedUnion('evaluatorKey', [
  z.object({
    evaluatorKey: z.literal('MATCH_RESULT'),
    parameters: matchResultParameters,
  }),
  z.object({
    evaluatorKey: z.literal('TOTAL_GOALS'),
    parameters: totalGoalsParameters,
  }),
  z.object({
    evaluatorKey: z.literal('DOUBLE_CHANCE'),
    parameters: doubleChanceParameters,
  }),
  z.object({ evaluatorKey: z.literal('BTTS'), parameters: bttsParameters }),
  z.object({
    evaluatorKey: z.literal('TOTAL_CORNERS'),
    parameters: totalCornersParameters,
  }),
  z.object({
    evaluatorKey: z.literal('COMPOSITE'),
    parameters: compositeParameters,
  }),
]);

export const evaluatorKeys = [...primitiveEvaluatorKeys, 'COMPOSITE'] as const;

export type AutoMarketConfig = z.infer<typeof autoMarketConfigSchema>;

export function validateMarketConfiguration(input: {
  autoEvaluable: boolean;
  evaluatorKey: string | null;
  parameters: unknown;
}): {
  evaluatorKey: AutoMarketConfig['evaluatorKey'] | null;
  parameters: AutoMarketConfig['parameters'] | null;
} {
  if (!input.autoEvaluable) {
    return { evaluatorKey: null, parameters: null };
  }

  return autoMarketConfigSchema.parse({
    evaluatorKey: input.evaluatorKey,
    parameters: input.parameters,
  });
}
