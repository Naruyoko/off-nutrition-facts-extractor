import React, { useState } from 'react';
import { ExtractionData, OutputFormat } from '../types';
import {
  generateOFFFormInputsFormat,
  generateAsciiTable,
  generateMarkdownTable,
  generateTsvFormat,
} from '../utils/formatters';
import { Copy, Check, Download, FileText, Code, Table, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { InfoText } from './InfoText';
import { useTaxonomyContext } from '../context/TaxonomyContext';

export const OutputFormatTabs: React.FC<{ data: ExtractionData }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<OutputFormat>('off-keyvalue');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const { isRecognizedKey } = useTaxonomyContext();

  if (!data) return null;

  const formInputsText = generateOFFFormInputsFormat(data);
  const asciiText = generateAsciiTable(data);
  const markdownText = generateMarkdownTable(data);
  const tsvText = generateTsvFormat(data);

  const getCurrentText = (): string => {
    switch (activeTab) {
      case 'off-keyvalue': return formInputsText;
      case 'ascii': return asciiText;
      case 'markdown': return markdownText;
      case 'tsv': return tsvText;
      default: return asciiText;
    }
  };

  const getFileExtension = (): string => {
    switch (activeTab) {
      case 'markdown': return 'md';
      case 'tsv': return 'tsv';
      default: return 'txt';
    }
  };

  const handleCopy = () => {
    const textToCopy = getCurrentText();
    navigator.clipboard.writeText(textToCopy);
    setCopiedTab(activeTab);
    setTimeout(() => {
      setCopiedTab(null);
    }, 2500);
  };

  const handleDownload = () => {
    const text = getCurrentText();
    const ext = getFileExtension();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nutrition_facts_off_${activeTab}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ui-card p-4 sm:p-5 space-y-4">
      {/* Header & Copy Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Open Food Facts Export Formats</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Exports all active nutrition input sets with <code className="font-mono text-indigo-500 dark:text-indigo-400">nutrition_input_sets_&lt;set_id&gt;_shown = "1"</code>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 primary-button shadow-sm 
                ${copiedTab === activeTab && 'bg-indigo-500 font-bold'}`}
            >
              {copiedTab === activeTab ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Text Table</span>
                </>
              )}
            </button>

            <button onClick={handleDownload} className="inline-flex items-center gap-1.5 secondary-button">
              <Download className="w-4 h-4 icon-like" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
      </div>

      {/* Validation Warning */}
      {data.nutrients.some(({ key }) => !isRecognizedKey(key)) && (
        <div className="alert-warning text-xs !p-3 !rounded-xl !gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <strong>Warning:</strong> The following nutrient keys are not in the standard taxonomy and may cause issues during export:
            <ul className="list-disc pl-4 mt-1">
              {data.nutrients
                .filter(({ key }) => !isRecognizedKey(key))
                .map(({ id, key }) => <li key={id} className="font-mono">{key}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Export Tabs Selector */}
      <div className="flex flex-wrap border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 gap-1 p-1.5 rounded-xl transition-colors">
        {([
          ['off-keyvalue', 'OFF Form Input Element Names', Code],
          ['ascii', 'Plain ASCII Table', FileText],
          ['markdown', 'Markdown Table', Table],
          ['tsv', 'TSV / Excel', FileSpreadsheet],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all ${
              activeTab === id
                ? 'bg-white text-indigo-600 font-semibold shadow-sm border border-slate-300 dark:bg-slate-800 dark:text-indigo-400 dark:border-slate-700/80 dark:shadow'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Output Content Area */}
      <div className="relative group">
        <textarea 
          className="ui-input font-mono text-xs sm:text-sm p-4 rounded-xl overflow-x-auto leading-relaxed max-h-[450px] shadow-inner selection:bg-indigo-500/30 w-full h-[450px] resize-none"
          value={getCurrentText()}
          readOnly
          spellCheck="false"
        />
      </div>

      {/* Form Injector Userscript Tutorial */}
      {activeTab == 'off-keyvalue' &&
        <InfoText>
          This option is intended for use with a userscript to inject the values into the product editor. Install it <a href="https://github.com/Naruyoko/power-user-script/blob/Naruyoko-custom/NutritionFormInjector.user.js" className="link" target="_blank" rel="noopener noreferrer">here</a>, and scroll to the Nutrition section.
        </InfoText>
      }
    </div>
  );
};
