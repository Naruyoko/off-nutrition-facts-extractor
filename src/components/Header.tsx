import React from 'react';
import { Utensils, Moon, Sun } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useThemeContext();

  return (
    <header className="bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-white border-b py-6 px-4 sm:px-6 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
            <Utensils className="w-7 h-7 icon-like" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Nutrition Facts Extractor
              </h1>
            </div>
            <p className="text-xs sm:text-sm mt-0.5 text-slate-600 dark:text-slate-400">
              Extract nutrition labels from image URLs or uploaded photos and convert them to formatted tables for Open Food Facts
            </p>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="inline-flex items-center gap-2 shadow-sm secondary-button"
          title={theme === 'light' ? 'Switch to Night Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span>Night Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
