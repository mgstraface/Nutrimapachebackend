import { createContext, useContext } from 'react';
import type { MealSheetTarget } from './MealSheet';

export const RegisterContext = createContext<(t: MealSheetTarget) => void>(() => {});
export const useOpenMealSheet = () => useContext(RegisterContext);
