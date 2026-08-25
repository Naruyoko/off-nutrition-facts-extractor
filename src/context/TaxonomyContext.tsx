import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type TaxonomyData = Record<string, Record<string, string[]>>;

interface TaxonomyContextType {
  data: TaxonomyData;
  isLoading: boolean;
  isRecognizedKey: (key: string) => boolean;
  getCanonicalName: (key: string, lang: string) => string | null;
  getSynonyms: (key: string, lang: string) => string[];
}

const TaxonomyContext = createContext<TaxonomyContextType | undefined>(undefined);

export const TaxonomyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<TaxonomyData>({}); //Note: Will be initialized once and never written to.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/taxonomy-keys')
      .then(res => res.json())
      .then(json => setData(json.tags))
      .catch(err => console.error("Failed to fetch taxonomy keys", err))
      .finally(() => setIsLoading(false));
  }, []);

  const isRecognizedKey = (key: string) => !!data[key];

  const getCanonicalName = (key: string, lang: string): string | null => {
    const nutrient = data[key];
    if (nutrient?.[lang]?.length > 0) return nutrient[lang][0];
    if (nutrient?.['en']?.length > 0) return nutrient['en'][0];
    return null;
  };

  const getSynonyms = (key: string, lang: string): string[] => {
    const nutrient = data[key];
    if (nutrient?.[lang]?.length > 0) return nutrient[lang];
    if (nutrient?.['en']?.length > 0) return nutrient['en'];
    return [key];
  };

  return (
    <TaxonomyContext.Provider value={{ 
      data, 
      isLoading, 
      isRecognizedKey, 
      getCanonicalName, 
      getSynonyms 
    }}>
      {children}
    </TaxonomyContext.Provider>
  );
};

export const useTaxonomyContext = () => {
  const context = useContext(TaxonomyContext);
  if (context === undefined) {
    throw new Error('useTaxonomyContext must be used within a TaxonomyProvider');
  }
  return context;
};
