import { z } from 'zod';

export interface NutrientItem {
  id: string;
  key: string;
  suggestedKey?: string;
  displayedName?: string;
  printedName?: string;
  values: Partial<Record<InputSetId, string>>;
  unit: string;
  confidence?: 'high' | 'medium' | 'low' | string;
  note?: string;
  isCustom?: boolean;
}

export const INPUT_SET_IDS = [
  'as_sold_100g',
  'as_sold_100ml',
  'as_sold_1l',
  'as_sold_serving',
  'prepared_100g',
  'prepared_100ml',
  'prepared_1l',
  'prepared_serving'
] as const;

export type InputSetId = typeof INPUT_SET_IDS[number];

export interface ExtractionData {
  servingSize: string;
  detectedLanguage: string;
  currentLanguage: string;
  confidenceScore: number;
  nutrients: (NutrientItem & {displayedName: string})[];
  unrecognizedNutrients: NutrientItem[];
  enabledInputSets: Record<InputSetId, boolean>;
  extractionPrompt: string;
  extractionResponse: string;
  languageDetectionPrompt: string;
  languageDetectionResponse: string;
}

export const extractionJsonSchema =
  z.object({
    servingSize: z.string(),
    detectedLanguage: z.string(),
    confidenceScore: z.number(),
    nutrients: z.array(
      z.object({
        key: z.string(),
        printedName: z.string(),
        values: z.partialRecord(z.enum(INPUT_SET_IDS), z.string()),
        unit: z.string(),
        confidence: z.string().optional(),
        note: z.string().optional(),
      })
    ),
    unrecognizedNutrients: z.array(
      z.object({
        suggestedKey: z.string().optional(),
        printedName: z.string(),
        values: z.record(z.string(), z.string()),
        unit: z.string(),
        confidence: z.string().optional(),
        note: z.string().optional(),
      })
    ),
  });

export type ExtractionSchema = z.infer<typeof extractionJsonSchema>;

interface ExtractionServerResponseData {
  languageDetectionPrompt: string,
  languageDetectionResponse: string,
  extractionPrompt: string,
  extractionResponse: string,
  data: ExtractionSchema,
}

export type ExtractionServerResponse =
  { success: false, error: string } & Partial<ExtractionServerResponseData> |
  { success: true } & ExtractionServerResponseData

export interface SampleImage {
  id: string;
  name: string;
  url: string;
  description: string;
  flag?: string;
}

export type OutputFormat = 'ascii' | 'off-keyvalue' | 'markdown' | 'tsv';
