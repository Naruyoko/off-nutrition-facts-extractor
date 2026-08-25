import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Link,
  Upload,
  BookImage,
  Check,
  Loader2,
  ScanEye,
  ArrowRight,
} from 'lucide-react';
import { SAMPLE_IMAGES } from '../data/sampleImages';
import { SampleImage } from '../types';

interface ImageSelectorProps {
  currentUrl: string;
  onUrlChange: (url: string) => void;
  onExtract: (urlOrBase64?: string, isBase64?: boolean) => void;
  isLoading: boolean;
  selectedSampleId: string | null;
  onSelectSample: (sample: SampleImage | null) => void;
  onPreviewChange: (preview: string | null) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  setErrorMessage: (error: string | null) => void;
}

export const ImageSelector: React.FC<ImageSelectorProps> = ({
  currentUrl,
  onUrlChange,
  onExtract,
  isLoading,
  selectedSampleId,
  onSelectSample,
  onPreviewChange,
  selectedModel,
  onModelChange,
  setErrorMessage,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'samples'>('url');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use refs to avoid stale closures in the global paste handler
  const onExtractRef = useRef(onExtract);
  const onPreviewChangeRef = useRef(onPreviewChange);
  const onSelectSampleRef = useRef(onSelectSample);
  const setErrorMessageRef = useRef(setErrorMessage);

  useEffect(() => {
    onExtractRef.current = onExtract;
    onPreviewChangeRef.current = onPreviewChange;
    onSelectSampleRef.current = onSelectSample;
    setErrorMessageRef.current = setErrorMessage;
  });

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessageRef.current('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    // Trigger visual feedback flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 1200);

    onSelectSampleRef.current(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      onPreviewChangeRef.current(result);
      onExtractRef.current(result, true);
    };
    reader.readAsDataURL(file);
  };

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            setActiveTab('upload');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []); // Stable listener

  const handleUrlSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    onPreviewChange(currentUrl.trim());
    onExtract(currentUrl.trim(), false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    }
  };

  return (
    <div className="ui-card">
      {/* Model Selection Bar */}
      <div className="border-b px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-colors bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300 rounded-t-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <ScanEye className="w-4 h-4 icon-like shrink-0" />
          <span>Gemini Vision Model:</span>
        </div>
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={isLoading}
          className="w-full sm:w-auto bg-white border-slate-300 text-slate-900 hover:border-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-100 border rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
        >
          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
          <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
          <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
        </select>
      </div>

      {/* Top Tab Bar */}
      <div className="flex border-b bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800 p-1.5 gap-1 transition-colors">
        {([
          ['url', 'Image URL', Link],
          ['upload', 'Upload / File', Upload],
          ['samples', 'Sample Labels', BookImage],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50
            ${activeTab === id
              ? 'bg-white text-indigo-800 shadow-sm border border-slate-300 font-semibold dark:bg-slate-800 dark:text-white dark:border-slate-700/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900/50'}`}
          >
            <Icon className="w-4 h-4 icon-like" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {/* URL Input Tab */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Nutrition Facts Image URL
              </label>
              <div className="relative flex items-center">
                <input
                  type="url"
                  value={currentUrl}
                  onChange={(e) => {
                    onUrlChange(e.target.value);
                    onSelectSample(null);
                  }}
                  placeholder="https://example.com/nutrition_facts_label.jpg"
                  className="ui-input px-4 py-3 text-sm pr-24 transition-all"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !currentUrl.trim()}
                  className={`absolute right-1.5 inline-flex items-center gap-1.5 primary-button shadow-sm
                    ${(isLoading || !currentUrl.trim()) && 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <span>Extract</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Upload File Tab */}
        {activeTab === 'upload' && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/60 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-slate-600 dark:hover:bg-slate-950'
            }`}
          >
            <AnimatePresence>
              {isFlashing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, repeat: 1 }}
                  className="absolute inset-0 bg-indigo-500/15 border-2 border-indigo-500 rounded-xl pointer-events-none z-10"
                />
              )}
            </AnimatePresence>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-slate-200 border-slate-300 dark:bg-slate-800 dark:border-slate-700 border mx-auto flex items-center justify-center mb-3 shadow-inner">
              <Upload className="w-6 h-6 icon-like" />
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Drag & drop photo here or <span className="text-indigo-600 dark:text-indigo-400 underline decoration-indigo-500/30 underline-offset-2 hover:text-indigo-500 transition-colors">browse files</span>
            </p>
            <p className="text-xs text-slate-500 mt-1.5">
              Supports JPG, PNG, WEBP, or camera photos. <span className="text-indigo-600 dark:text-indigo-400 font-medium">Tip: Paste (Ctrl+V / Cmd+V) an image from your clipboard anytime!</span> On the OFF website's product editor, you can right-click on the cropped photo to copy it without downloading it as a file.
            </p>
          </div>
        )}

        {/* Sample Images Tab */}
        {activeTab === 'samples' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select a sample nutrition facts label to test extraction in 1 click:
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    onSelectSample(sample);
                    onUrlChange(sample.url);
                    onPreviewChange(sample.url);
                    onExtract(sample.url, false);
                    setActiveTab('url');
                  }}
                  disabled={isLoading}
                  className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all ${
                    selectedSampleId === sample.id
                      ? 'bg-indigo-500/15 border-indigo-500/60 text-indigo-900 dark:text-white font-medium shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:bg-slate-950/60 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start gap-2.5 pr-2">
                    <span className="text-xl shrink-0 mt-0.5">{sample.flag}</span>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                        {sample.name}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {sample.description}
                      </div>
                    </div>
                  </div>
                  {selectedSampleId === sample.id ? (
                    <span className="p-1 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
