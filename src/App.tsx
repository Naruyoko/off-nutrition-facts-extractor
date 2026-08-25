import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { ImageSelector } from './components/ImageSelector';
import { ImagePreview } from './components/ImagePreview';
import { EditableNutrientTable } from './components/EditableNutrientTable';
import { OutputFormatTabs } from './components/OutputFormatTabs';
import { ExtractionData, ExtractionServerResponse, INPUT_SET_IDS, InputSetId, SampleImage } from './types';
import { SAMPLE_IMAGES } from './data/sampleImages';
import {
  AlertCircle,
  FileCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { useImageZoom } from './hooks/useImageZoom';
import { useThemeContext } from './context/ThemeContext';
import { useTaxonomyContext } from './context/TaxonomyContext';

export default function App() {
  const { isTransitioning } = useThemeContext();
  const { getCanonicalName } = useTaxonomyContext();
  const zoomProps = useImageZoom();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  const COOLDOWN_MS = 3000;

  // Extracted Data
  const [extractedData, setExtractedData] = useState<ExtractionData | null>(null);
  const [originalExtractedData, setOriginalExtractedData] = useState<ExtractionData | null>(null);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);

  // Reset zoom whenever preview image changes
  useEffect(() => {
    zoomProps.setZoomLevel(1);
  }, [previewImage]);

  const handleSelectSample = (sample: SampleImage | null) => {
    setSelectedSampleId(sample?.id);
  };

  const handleExtract = async (urlOrBase64?: string, isBase64: boolean = false) => {
    const now = Date.now();
    if (now - lastRequestTime < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastRequestTime)) / 1000);
      setErrorMessage(`Please wait ${remaining}s before making another request to stay within quota limits.`);
      return;
    }

    setLastRequestTime(now);
    setIsLoading(true);
    setErrorMessage(null);

    const payload: Record<string, any> = {
      model: selectedModel,
    };
    if (isBase64 && urlOrBase64) {
      payload.imageBase64 = urlOrBase64;
    } else {
      const urlToUse = urlOrBase64 || imageUrl;
      payload.imageUrl = urlToUse;
    }

    try {
      const response = await fetch('/api/extract-nutrition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000), // 90 second client-side timeout
      });

      const contentType = response.headers.get('content-type') || '';
      let resData_: any = {};

      if (contentType.includes('application/json')) {
        resData_ = await response.json();
      } else {
        const textResponse = await response.text();
        console.error('Non-JSON response from server:', textResponse);
        throw new Error(
          `Server error (${response.status}): ${
            textResponse.startsWith('<!') || textResponse.includes('<html')
              ? 'The server returned an HTML error page. Please retry or check server connection.'
              : textResponse.slice(0, 150)
          }`
        );
      }
      
      let resData: ExtractionServerResponse = resData_;

      if (!response.ok || !resData.success) {
        throw new Error(resData_.error || 'Failed to extract nutrition facts from image.');
      }

      let {
        languageDetectionPrompt,
        languageDetectionResponse,
        extractionPrompt,
        extractionResponse,
        data,
      } = resData;
      
      let now = Date.now();

      // Detect set IDs with values
      const detected: string[] = [];

      [...data.nutrients, ...data.unrecognizedNutrients].forEach(n => 
        Object.keys(n.values).forEach(k => {
          if (n.values[k]?.trim() && !detected.includes(k)) {
            detected.push(k);
          }
        }
      ));

      let enabledInputSets = {} as Record<InputSetId, boolean>;
      INPUT_SET_IDS.forEach(id => enabledInputSets[id] = detected.includes(id));

      let finalData: ExtractionData = {
        ...data,
        currentLanguage: data.detectedLanguage,
        nutrients: data.nutrients.map((item, idx) => ({
          ...item,
          id: `nutr-${idx}-${now}`,
          displayedName: getCanonicalName(item.key, data.detectedLanguage)
        })),
        unrecognizedNutrients: data.unrecognizedNutrients.map((item, idx) => {
          const baseId = item.suggestedKey ? `suggested-${item.suggestedKey}` : `unknown-${item.printedName.trim().substring(0, 10).toLowerCase().replace(/\s/g,"-")}`;
          return {
            ...item,
            id: `unrec-${idx}-${now}`,
            key: baseId,
          };
        }),
        enabledInputSets,
        languageDetectionPrompt,
        languageDetectionResponse,
        extractionPrompt,
        extractionResponse,
      };

      setExtractedData(finalData);
      setOriginalExtractedData(finalData);
    } catch (err: any) {
      console.error('Extraction error:', err);
      let message = err.message || 'An unexpected error occurred during image processing.';
      if (err.name === 'AbortError') {
        message = 'The extraction request timed out. Please try again or use a smaller image.';
      }
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetOriginal = () => {
    if (originalExtractedData) {
      setExtractedData(JSON.parse(JSON.stringify(originalExtractedData)));
    }
  };

  // Sync displayedName with currentLanguage
  useEffect(() => {
    if (extractedData) {
      setExtractedData({
        ...extractedData,
        nutrients: extractedData.nutrients.map(n => ({
          ...n,
          displayedName: getCanonicalName(n.key, extractedData.currentLanguage)
        }))
      });
    }
  }, [extractedData?.currentLanguage]);

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors`}>
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Input & Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <ImageSelector
              currentUrl={imageUrl}
              onUrlChange={setImageUrl}
              onExtract={handleExtract}
              isLoading={isLoading}
              selectedSampleId={selectedSampleId}
              onSelectSample={handleSelectSample}
              onPreviewChange={setPreviewImage}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              setErrorMessage={setErrorMessage}
            />
            {/* Desktop Sticky Preview */}
            <div className="hidden lg:block lg:sticky lg:top-8">
              <ImagePreview
                previewImage={previewImage}
                isLoading={isLoading}
                setErrorMessage={setErrorMessage}
                {...zoomProps}
              />
            </div>
            {/* Mobile Floating Preview Trigger */}
            {previewImage && (
              <button
                onClick={() => setIsMobilePreviewOpen(true)}
                className="lg:hidden fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg z-50 hover:bg-indigo-500 transition-colors"
              >
                <ImageIcon className="w-7 h-7 stroke-[1.5]" />
              </button>
            )}
            {/* Mobile Preview Modal */}
            {isMobilePreviewOpen && (
              <div 
                className="lg:hidden fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-950/30"
                onClick={() => setIsMobilePreviewOpen(false)}
              >
                <div 
                  className="bg-white dark:bg-slate-900 w-full max-w-lg p-4 rounded-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Image Preview</h3>
                    <button onClick={() => setIsMobilePreviewOpen(false)} className="text-slate-500 hover:text-slate-300">Close</button>
                  </div>
                  <ImagePreview
                    previewImage={previewImage}
                    isLoading={isLoading}
                    setErrorMessage={setErrorMessage}
                    {...zoomProps}
                  />
                </div>
              </div>
            )}
            {/* Provenance Modal */}
            {isProvenanceOpen && extractedData && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/50 backdrop-blur-sm"
                onClick={() => setIsProvenanceOpen(false)}
              >
                <div 
                  className="bg-white dark:bg-slate-900 shadow-2xl dark:shadow-none border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[80vh] p-6 rounded-2xl overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Data Provenance</h3>
                    <button 
                      onClick={() => setIsProvenanceOpen(false)} 
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-6">
                    {[
                      ['Language Detection Prompt', extractedData.languageDetectionPrompt, 'h-20'],
                      ['Language Detection Output', extractedData.languageDetectionResponse, 'h-20'],
                      ['Extraction Prompt', extractedData.extractionPrompt, 'h-48'],
                      ['Extraction Output', extractedData.extractionResponse, 'h-48'],
                    ].map(([heading, content, height]) => (
                      <div key={heading}>
                        <h4 className="font-bold mb-2 text-indigo-600 dark:text-indigo-400">{heading}</h4>
                        <textarea 
                          readOnly
                          value={content}
                          className={`w-full ${height} text-xs p-4 rounded-xl font-mono border resize-none focus:outline-none bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Extracted Table & Output (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Error Banner */}
            {errorMessage && (
              <div className="alert-error animate-fadeIn">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="font-bold text-rose-800 dark:text-rose-300">Extraction Failed</div>
                  <div className="text-rose-700 dark:text-rose-200/80">{errorMessage}</div>
                  <div className="pt-2">
                    <button
                      onClick={() => handleExtract()}
                      className="inline-flex items-center gap-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 dark:text-rose-200 dark:border-rose-500/40 border text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Extraction
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State / Welcome Guide */}
            {!extractedData && !isLoading && !errorMessage && (
              <div className="ui-card p-6 sm:p-8 text-center space-y-6 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 mx-auto flex items-center justify-center shadow-inner">
                  <FileCheck className="w-8 h-8 icon-like" />
                </div>

                <div className="max-w-md mx-auto space-y-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Ready to Extract Nutrition Facts
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    Paste an image URL, upload a file, use the clipboard, or select a sample on the left to instantly extract structured nutritional values formatted for Open Food Facts.
                  </p>
                </div>

                {/* 3 Step Workflow */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
                  {[
                    ['Provide Image', 'Enter a photo URL or upload a label file'],
                    ['AI Gemini Vision', 'Scans nutrients, units, and serving sizes'],
                    ['Copy Formatted Text', 'Copy plain text table or key-value fields']
                  ].map(([title, description], i) => (
                    <div
                      key={i}
                      className="bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800/80 border p-3.5 rounded-xl space-y-1.5 transition-colors"
                    >
                      <div
                        className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 icon-like text-xs font-bold flex items-center justify-center"
                      >
                        {i + 1}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                        {title}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {description}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Test Sample CTA */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => {
                      const sample = SAMPLE_IMAGES[0];
                      handleSelectSample(sample);
                      setImageUrl(sample.url);
                      setPreviewImage(sample.url);
                      handleExtract(sample.url, false);
                    }}
                    className="inline-flex items-center gap-2 primary-button shadow-md"
                  >
                    <Zap className="w-4 h-4 fill-white text-white" />
                    <span>Try 1-Click Sample</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Extraction Results */}
            {extractedData && (
              <div className="space-y-6 animate-fadeIn">
                {/* Confidence & Detection Bar */}
                <div className="ui-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30 border rounded-xl">
                      <CheckCircle2 className="w-5 h-5 icon-like" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Extraction Complete</span>
                        <span className="text-[11px] bg-indigo-500/15 text-indigo-950 dark:text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                          {Math.round((extractedData.confidenceScore) * 100)}% Confidence
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Detected Language: {extractedData.detectedLanguage}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsProvenanceOpen(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                  >
                    View AI Output
                  </button>
                </div>

                {/* Editable Nutrients Table */}
                <EditableNutrientTable
                  data={extractedData}
                  onChange={setExtractedData}
                  onResetOriginal={handleResetOriginal}
                />

                {/* Output Formats Tabs */}
                <OutputFormatTabs data={extractedData} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-900 py-6 px-4 text-center transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            This application uses the <span className="font-semibold text-slate-700 dark:text-slate-200">Google Gemini API Free Tier</span> for image understanding and text extraction.
            <br />
            <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-700 dark:text-slate-200">Privacy:</span> Data submitted via the Free Tier may be used by Google to improve products and services. Do not upload sensitive or personal information.
            <br />
            <span className="font-semibold uppercase tracking-wider text-[9px] text-slate-700 dark:text-slate-200">Availability:</span> Subject to API rate limits; service may become temporarily unavailable if limits are exceeded.
            <br />
            <div className="mt-2 flex items-center justify-center gap-2">
              <a href="https://ai.google.dev/gemini-api/terms" className="link" target="_blank" rel="noopener noreferrer">Gemini Terms of Service</a>
              <span className="text-slate-300 dark:text-slate-800">•</span>
              <a href="https://ai.google.dev/pricing" className="link" target="_blank" rel="noopener noreferrer">API Rate Limits</a>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 text-slate-600 dark:border-slate-900 dark:text-slate-500 text-xs">
            Built for <a href="https://world.openfoodfacts.org/" className="font-medium link" target="_blank" rel="noopener noreferrer">Open Food Facts</a> contributors using Google Gemini Multimodal AI.
          </div>
        </div>
      </footer>

      {/* Theme Transition Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[9999] bg-slate-500/80 dark:bg-slate-800/80 backdrop-blur-sm pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
