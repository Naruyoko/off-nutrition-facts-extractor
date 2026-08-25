import { ExtractionData, NutrientItem, InputSetId, INPUT_SET_IDS } from '../types';

export interface InputSetDefinition {
  id: InputSetId;
  label: string;
  shortLabel: string;
  prep: 'as_sold' | 'prepared';
  basis: '100g' | '100ml' | '1l' | 'serving';
}

export const INPUT_SETS: InputSetDefinition[] = [
  { id: 'as_sold_100g', label: 'As Sold (per 100g)', shortLabel: 'As Sold\u00A0100g', prep: 'as_sold', basis: '100g' },
  { id: 'as_sold_100ml', label: 'As Sold (per 100ml)', shortLabel: 'As Sold\u00A0100ml', prep: 'as_sold', basis: '100ml' },
  { id: 'as_sold_1l', label: 'As Sold (per 1l)', shortLabel: 'As Sold\u00A01l', prep: 'as_sold', basis: '1l' },
  { id: 'as_sold_serving', label: 'As Sold (per serving)', shortLabel: 'As Sold\u00A0Serving', prep: 'as_sold', basis: 'serving' },
  { id: 'prepared_100g', label: 'Prepared (per 100g)', shortLabel: 'Prepared\u00A0100g', prep: 'prepared', basis: '100g' },
  { id: 'prepared_100ml', label: 'Prepared (per 100ml)', shortLabel: 'Prepared\u00A0100ml', prep: 'prepared', basis: '100ml' },
  { id: 'prepared_1l', label: 'Prepared (per 1l)', shortLabel: 'Prepared\u00A01l', prep: 'prepared', basis: '1l' },
  { id: 'prepared_serving', label: 'Prepared (per serving)', shortLabel: 'Prepared\u00A0Serving', prep: 'prepared', basis: 'serving' },
];

/**
 * Get a human-readable label for an input set ID
 */
export function getInputSetLabel(setId: string): string {
  return INPUT_SETS.find(s => s.id === setId)?.label ?? setId.replace(/_/g, ' ');
}

/**
 * Get short label for table header
 */
export function getInputSetShortLabel(setId: string): string {
  return INPUT_SETS.find(s => s.id === setId)?.shortLabel ?? setId;
}

/**
 * Retrieve value string for a specific input set ID from a nutrient item
 */
export function getNutrientValue(nutrient: NutrientItem, setId: string): string {
  return nutrient.values[setId] ?? '';
}

/**
 * Update value string for a specific input set ID on a nutrient item
 */
export function withNutrientValue<T extends NutrientItem>(nutrient: T, setId: string, value: string): T {
  return { ...nutrient, values: { ...nutrient.values, [setId]: value }};
}

/**
 * Returns a list of enabled input set IDs for extraction data
 */
export function getEnabledInputSetIds(data: ExtractionData): InputSetId[] {
  return INPUT_SET_IDS.filter(id => data.enabledInputSets[id]);
}

/**
 * Clean numeric string to number
 */
export function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Generate Open Food Facts Form Input Element Names Format
 * Structure for multiple sets:
 *   nutrition_input_sets_<set_id>_shown = "1"
 *   nutrition_input_sets_<set_id>_nutrients_<key>_value_string = "12.5"
 *   nutrition_input_sets_<set_id>_nutrients_<key>_unit = "g"
 */
export function generateOFFFormInputsFormat(data: ExtractionData): string {
  const lines: string[] = [];
  const enabledInputSetIds = getEnabledInputSetIds(data);

  lines.push('# Open Food Facts HTML Form Input Element Names');
  lines.push('# Multiple input sets (e.g. as_sold_100g, as_sold_serving, prepared_100g)');
  lines.push('# Copy & paste directly into Open Food Facts edit forms');
  lines.push('');

  if (data.servingSize) {
    lines.push(`serving_size = "${data.servingSize}"`);
    lines.push('');
  }

  // Global Nutrient Units (shared between value sets, e.g. global_nutrient_proteins_unit)
  lines.push('# Global Nutrient Units (shared between value sets)');
  data.nutrients.forEach((n) => {
    lines.push(`global_nutrient_${n.key}_unit = "${n.unit}"`);
  });
  lines.push('');

  enabledInputSetIds.forEach((setId) => {
    const label = getInputSetLabel(setId);
    lines.push(`# Set: ${label}`);
    lines.push(`nutrition_input_sets_${setId}_shown = "1"`);

    data.nutrients.forEach((n) => {
      const val = getNutrientValue(n, setId);

      if (val && val.trim() !== '') {
        lines.push(`nutrition_input_sets_${setId}_nutrients_${n.key}_value_string = "${val.trim()}"`);
      }
    });

    lines.push('');
  });

  return lines.join('\n').trim();
}

/**
 * Generate ASCII Plain Text Table
 */
export function generateAsciiTable(data: ExtractionData): string {
  const lines: string[] = [];
  const enabledInputSetIds = getEnabledInputSetIds(data);

  const border = '===================================================================';
  const subBorder = '-------------------------------------------------------------------';

  lines.push(border);
  lines.push('               OPEN FOOD FACTS - NUTRITION FACTS TABLE              ');
  lines.push(border);
  lines.push(`Serving Size: ${data.servingSize || 'Not specified'}`);
  lines.push(`Label Format: ${data.labelFormat || 'Standard'} | Language: ${data.detectedLanguage}`);
  lines.push(subBorder);

  const col1Width = 24;
  const colSetWidth = 18;
  const pad = (str: string, len: number) => (str || '').padEnd(len).substring(0, len);

  const headers = [pad('Nutrient', col1Width)];
  enabledInputSetIds.forEach(id => headers.push(pad(getInputSetShortLabel(id), colSetWidth)));

  lines.push(headers.join(' | '));
  lines.push(subBorder);

  data.nutrients.forEach((n) => {
    const name = n.displayedName;
    let printedLabel = name;
    if (['saturated-fat', 'trans-fat', 'sugars', 'added-sugars', 'polyols', 'sodium'].includes(n.key.toLowerCase())) {
      printedLabel = `  - ${name}`;
    }

    const row = [pad(printedLabel, col1Width)];
    enabledInputSetIds.forEach(id => {
      const val = getNutrientValue(n, id);
      const formattedVal = val ? `${val} ${n.unit}`.trim() : '-';
      row.push(pad(formattedVal, colSetWidth));
    });

    lines.push(row.join(' | '));
  });

  lines.push(border);

  return lines.join('\n');
}

/**
 * Generate Markdown Table Format
 */
export function generateMarkdownTable(data: ExtractionData): string {
  const lines: string[] = [];
  const enabledInputSetIds = getEnabledInputSetIds(data);

  lines.push(`### Nutrition Facts (${data.servingSize ? `Serving size: ${data.servingSize}` : 'Open Food Facts'})`);
  lines.push('');

  const headers = ['Nutrient', ...enabledInputSetIds.map(getInputSetLabel), 'Unit'];
  const aligns = [' :--- ', ...enabledInputSetIds.map(() => ' :--- '), ' :--- '];

  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`|${aligns.join('|')}|`);

  data.nutrients.forEach((n) => {
    let name = n.displayedName;
    if (['saturated-fat', 'sugars', 'added-sugars', 'trans-fat', 'sodium'].includes(n.key.toLowerCase())) {
      name = `&nbsp;&nbsp;↳ *${name}*`;
    } else {
      name = `**${name}**`;
    }

    const rowValues = enabledInputSetIds.map(id => getNutrientValue(n, id) || '-');
    lines.push(`| ${name} | ${rowValues.join(' | ')} | ${n.unit} |`);
  });

  return lines.join('\n');
}

/**
 * Generate TSV (Tab Separated Values)
 */
export function generateTsvFormat(data: ExtractionData): string {
  const enabledInputSetIds = getEnabledInputSetIds(data);
  const lines: string[] = [];

  const headers = ['Nutrient Key', 'Displayed Name', ...enabledInputSetIds.map(getInputSetLabel), 'Unit'];
  lines.push(headers.join('\t'));

  data.nutrients.forEach((n) => {
    const row = [n.key, n.displayedName, ...enabledInputSetIds.map(id => getNutrientValue(n, id)), n.unit];
    lines.push(row.join('\t'));
  });

  return lines.join('\n');
}


