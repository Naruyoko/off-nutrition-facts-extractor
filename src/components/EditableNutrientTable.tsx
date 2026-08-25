import React, { useState, useEffect } from 'react';
import { ExtractionData, NutrientItem, InputSetId } from '../types';
import { Plus, Trash2, RotateCcw, AlertTriangle, CircleQuestionMark, Check, FileText } from 'lucide-react';
import {
  INPUT_SETS,
  getEnabledInputSetIds,
  getNutrientValue,
  getInputSetShortLabel,
} from '../utils/formatters';
import { NutrientSearchCombobox } from './NutrientSearchCombobox';
import { InfoText } from './InfoText';
import { useTaxonomyContext } from '../context/TaxonomyContext';

interface EditableNutrientTableProps {
  data: ExtractionData;
  onChange: (newData: ExtractionData) => void;
  onResetOriginal: () => void;
}

export const EditableNutrientTable: React.FC<EditableNutrientTableProps> = ({
  data,
  onChange,
  onResetOriginal,
}) => {
  const { isRecognizedKey, getCanonicalName } = useTaxonomyContext();

  if (!data) return null;

  const enabledSetIds = getEnabledInputSetIds(data);

  const handleToggleInputSet = (id: InputSetId) => {
    onChange({
      ...data,
      enabledInputSets: {
        ...data.enabledInputSets,
        [id]: !data.enabledInputSets[id]
      }
    });
  };

  const handleNutrientValueChange = (index: number, id: InputSetId, value: string) => {
    const updatedNutrients = [...data.nutrients];
    updatedNutrients[index] = {...updatedNutrients[index], values: {...updatedNutrients[index].values, [id]: value}};
    onChange({
      ...data,
      nutrients: updatedNutrients,
    });
  };

  const handleNutrientFieldChange = (index: number, field: keyof NutrientItem, value: string) => {
    const updatedNutrients = [...data.nutrients];
    const item = {...updatedNutrients[index], [field]: value};

    // If key changes, resync displayedName if valid
    if (field === 'key') {
      const canonical = getCanonicalName(value, data.currentLanguage);
      if (canonical) item.displayedName = canonical;
    }

    updatedNutrients[index] = item;

    onChange({
      ...data,
      nutrients: updatedNutrients,
    });
  };

  const handleAddNutrient = () => {
    const newItem = {
      id: `custom-${Date.now()}`,
      key: 'custom-nutrient',
      displayedName: 'New Nutrient',
      values: {},
      unit: 'g',
      confidence: 'high',
      isCustom: true,
    };
    onChange({
      ...data,
      nutrients: [...data.nutrients, newItem],
    });
  };

  const handleMoveUnrecognizedToNutrients = (index: number) => {
    const item = data.unrecognizedNutrients[index];
    
    onChange({
      ...data,
      nutrients: [
        ...data.nutrients,
        {
          ...item,
          displayedName: item.suggestedKey ? getCanonicalName(item.suggestedKey, data.currentLanguage) : item.printedName
        }
      ],
      unrecognizedNutrients: data.unrecognizedNutrients.filter((_, i) => i !== index),
    });
  };

  const handleDeleteNutrient = (index: number) => {
    const updatedNutrients = data.nutrients.filter((_, i) => i !== index);
    onChange({
      ...data,
      nutrients: updatedNutrients,
    });
  };

  const shortNutrientLabel = (n: NutrientItem) => {
    const entries = Object.entries(n.values).map(([k, v]) => [k, v.trim()] as [string, string]).filter(([_, v]) => v != '');
    const suggestionText = n.suggestedKey ? ` (Suggested: ${n.suggestedKey})` : '';
    return `${n.printedName}${suggestionText}${entries.length > 0 ? ` [${entries.map(([k, v]) => `${v} @ ${getInputSetShortLabel(k)}`).join(', ')} (${n.unit})]` : ''}`;
  }

  return (
    <div className="ui-card p-4 sm:p-5 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Extracted Nutrients Grid</h2>
            <span className="text-xs bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 border px-2 py-0.5 rounded-full font-mono">
              {data.nutrients.length} items
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Verify & edit extracted values across active Open Food Facts nutrition input sets
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onResetOriginal}
            className="inline-flex items-center gap-1.5 secondary-button"
            title="Reset to AI extraction"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Package & Label Info Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border-slate-200 dark:bg-slate-950/80 dark:border-slate-800/80 border p-3 rounded-xl transition-colors">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
            Serving Size
          </label>
          <input
            type="text"
            value={data.servingSize}
            onChange={(e) => onChange({ ...data, servingSize: e.target.value })}
            placeholder="e.g. 30g, 240ml"
            className="ui-input px-2.5 py-1.5"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
            Language (ISO code)
          </label>
          <input
            type="text"
            list="language-suggestions"
            value={data.currentLanguage}
            maxLength={2}
            onChange={(e) => onChange({ ...data, currentLanguage: e.target.value.toLowerCase().replace(/[^a-z]/g, '') })}
            placeholder="en"
            className="w-full bg-white border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 border focus:border-indigo-500 px-2 py-1.5 rounded-lg text-xs transition-colors"
          />
          <datalist id="language-suggestions">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
            <option value="it">Italiano</option>
            <option value="nl">Nederlands</option>
            <option value="pl">Polski</option>
            <option value="ru">Русский</option>
            <option value="pt">Português</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="ar">العربية</option>
          </datalist>
        </div>
      </div>

      {/* Input Sets Selector (OFF Checkboxes: nutrition_input_sets_<set_id>_shown) */}
      <div className="bg-slate-50 border-slate-200 dark:bg-slate-950/90 dark:border-slate-800 border p-3.5 rounded-xl space-y-2 transition-colors">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span>Show / Export Nutrition Input Sets (OFF Form Columns)</span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
              {enabledSetIds.length} Active {enabledSetIds.length === 1 ? 'Set' : 'Sets'}
            </span>
          </label>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            Check sets to export <code className="text-indigo-600 dark:text-indigo-400 font-mono text-[10px]">nutrition_input_sets_&lt;set_id&gt;_shown</code>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {INPUT_SETS.map((setDef) => {
            const isChecked = enabledSetIds.includes(setDef.id);
            return (
              <label
                key={setDef.id}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                  isChecked
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-slate-900 font-medium shadow-sm dark:bg-indigo-500/15 dark:border-indigo-500/50 dark:text-slate-100'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  className="nutrition_input_set w-4 h-4 rounded border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                  name={`nutrition_input_sets_${setDef.id}_shown`}
                  value="1"
                  checked={isChecked}
                  onChange={() => handleToggleInputSet(setDef.id)}
                />
                <span className="truncate" title={setDef.label}>
                  {setDef.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Editable Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl transition-colors" id="nutrition_data_table">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800 font-semibold border-b transition-colors">
            <tr>
              <th className="py-2 px-2 min-w-[140px]">Nutrient Name</th>
              <th className="py-2 px-2 min-w-[100px]">Key (OFF)</th>

              {/* Dynamic Columns for each Active Input Set */}
              {enabledSetIds.map((id) => (
                <th key={id} className="py-2 px-2 w-[80px]">
                  <div className="flex flex-col">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{getInputSetShortLabel(id)}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-normal">({id})</span>
                  </div>
                </th>
              ))}

              <th className="py-2 px-2 min-w-[70px]">Unit</th>
              <th className="py-2 px-2 w-[80px]">Confidence</th>
              <th className="py-2 px-2 w-[40px] text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800/60 dark:bg-slate-900/50 transition-colors">
            {data.nutrients.map((n, idx) => {
              return (
                <tr key={n.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors`}>
                  {/* Displayed Name */}
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      value={getCanonicalName(n.key, data.currentLanguage) || n.displayedName || n.key}
                      readOnly
                      className="w-full bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 border px-1.5 py-0.5 rounded text-xs transition-colors"
                    />
                  </td>

                  {/* Key */}
                  <td className={`relative py-1 px-2 font-mono text-[11px] text-slate-600 dark:text-slate-400 ${!isRecognizedKey(n.key) ? 'bg-rose-200 dark:bg-rose-900/50' : ''}`} style={!isRecognizedKey(n.key) ? { backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(244, 63, 94, 0.4) 10px, rgba(244, 63, 94, 0.4) 20px)` } : {}}>
                    <NutrientSearchCombobox
                      value={n.key}
                      printedName={n.printedName}
                      onChange={key => handleNutrientFieldChange(idx, 'key', key)}
                      labelLanguage={data.currentLanguage}
                    />
                  </td>

                  {/* Input Fields for Active Sets */}
                  {enabledSetIds.map((id) => {
                    const currentVal = getNutrientValue(n, id);
                    return (
                      <td key={id} className="py-1 px-2 w-[80px]">
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => handleNutrientValueChange(idx, id, e.target.value)}
                          placeholder="e.g. 12.5"
                          className="ui-input font-semibold px-1.5 py-0.5"
                        />
                      </td>
                    );
                  })}

                  {/* Unit */}
                  <td className="py-1 px-2">
                    <select
                      value={n.unit}
                      onChange={(e) => handleNutrientFieldChange(idx, 'unit', e.target.value)}
                      className="w-full bg-white border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 border focus:border-indigo-500 px-1 py-0.5 rounded text-xs transition-colors"
                    >
                      <option value="g">g</option>
                      <option value="mg">mg</option>
                      <option value="µg">µg</option>
                      <option value="kcal">kcal</option>
                      <option value="kJ">kJ</option>
                      <option value="% DV">% DV</option>
                      <option value="IU">IU</option>
                    </select>
                  </td>

                  {/* Confidence */}
                  <td className="py-1 px-2">
                    <div className="flex items-center gap-1.5">
                      {n.confidence == 'low' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border dark:border-amber-500/30 px-1 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> Low
                        </span>
                      ) : n.confidence == 'medium' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-800 bg-teal-100 border-teal-200 dark:text-teal-400 dark:bg-teal-500/10 dark:border dark:border-teal-500/30 px-1 py-0.5 rounded">
                          <CircleQuestionMark className="w-3 h-3" /> Medium
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-800 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border dark:border-indigo-500/30 px-1 py-0.5 rounded">
                          <Check className="w-3 h-3" /> High
                        </span>
                      )}
                      {n.note && (
                        <div className="group relative">
                          <FileText className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 cursor-help transition-colors" />
                          <div className="absolute bottom-full right-0 mb-2 w-max max-w-[200px] p-2 tooltip text-[10px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-normal leading-relaxed whitespace-pre-wrap">
                            {n.note}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Delete button */}
                  <td className="py-1 px-2 text-right">
                    <button
                      onClick={() => handleDeleteNutrient(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Delete nutrient"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Actions */}
      <div className="space-y-4 pt-2">
        {data.unrecognizedNutrients.length > 0 && (
          <div className="bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30 border p-3 rounded-xl transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-400">Unrecognized Nutrients</h3>
              <button
                onClick={() => navigator.clipboard.writeText(data.unrecognizedNutrients.map(shortNutrientLabel).join(', '))}
                className="text-[10px] font-semibold px-2 py-1 rounded border bg-white border-amber-300 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                Copy All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.unrecognizedNutrients.map((n, idx) => 
                <button
                  key={n.id}
                  onClick={() => handleMoveUnrecognizedToNutrients(idx)}
                  className="text-[11px] font-mono p-1.5 rounded border transition-colors bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/40"
                  title="Click to add to grid"
                >
                  {shortNutrientLabel(n)}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={handleAddNutrient}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 secondary-button"
          >
            <Plus className="w-4 h-4 icon-like" />
            <span>Add Nutrient Row</span>
          </button>

          <InfoText>
            All selected input sets are exported together in the text output formats below.
          </InfoText>
        </div>
      </div>
    </div>
  );
};
