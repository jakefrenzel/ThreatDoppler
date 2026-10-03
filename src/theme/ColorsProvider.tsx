import { createContext, useContext, type ReactNode } from 'react';

import { useIncreaseContrast } from '@/lib/a11y';
import { highContrastPalette, palette, type Palette } from './tokens';

const ColorsContext = createContext<Palette>(palette);

export function ColorsProvider({ children }: { children: ReactNode }) {
  const increaseContrast = useIncreaseContrast();
  return (
    <ColorsContext.Provider value={increaseContrast ? highContrastPalette : palette}>{children}</ColorsContext.Provider>
  );
}

export function useColors() {
  return useContext(ColorsContext);
}
