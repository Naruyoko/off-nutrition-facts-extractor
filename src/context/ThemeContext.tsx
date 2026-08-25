import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    document?.documentElement.classList.toggle('dark', theme == 'dark');
  }, [theme]);

  const toggleTheme = () => {
    setIsTransitioning(true);
    
    // Brief delay for transition animation start
    setTimeout(() => {
      setTheme(prev => prev === 'light' ? 'dark' : 'light');
      
      // Delay to clear transition state after animation finishes
      setTimeout(() => {
        setIsTransitioning(false);
      }, 70);
    }, 70);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
