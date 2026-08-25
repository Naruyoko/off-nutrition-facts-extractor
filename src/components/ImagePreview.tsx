import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, FileScan } from 'lucide-react';

interface ImagePreviewProps {
  previewImage: string | null;
  isLoading: boolean;
  setErrorMessage: (error: string | null) => void;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number; y: number };
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  previewImage,
  isLoading,
  setErrorMessage,
  zoomLevel,
  setZoomLevel,
  pan,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
}) => {
  if (!previewImage) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 z-10 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Image Preview
        </span>
        <div className="flex items-center gap-1 bg-white border-slate-300 dark:bg-slate-950 dark:border-slate-800 border rounded-lg p-1">
          <button
            onClick={() => setZoomLevel((z) => Math.max(1, z - 0.2))}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-slate-700 dark:text-slate-400 px-1 font-mono">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(5, z + 0.2))}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded transition-colors ml-0.5"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className={`relative bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-800 border rounded-xl overflow-hidden min-h-[220px] max-h-[400px] flex items-center justify-center p-2 group ${zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="transition-transform duration-75 ease-out flex items-center justify-center max-w-full max-h-full"
          style={{ transform: `scale(${zoomLevel}) translate(${pan.x}px, ${pan.y}px)` }}
        >
          <img
            src={previewImage}
            alt="Nutrition label preview"
            className="max-h-[360px] w-auto object-contain rounded-lg shadow-md"
            onError={() => {
              setErrorMessage('Failed to load image preview from URL.');
            }}
          />
        </div>

        {/* Scanning Animation overlay during extraction */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-10">
            <div className="relative w-16 h-16 mb-3">
              <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-spin"></div>
              <div className="absolute inset-0 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center icon-like">
                <FileScan className="w-7 h-7" />
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Extracting Facts with Gemini AI...</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 animate-pulse">Reading OCR text, nutrients, and units</span>
          </div>
        )}
      </div>
    </div>
  );
};
