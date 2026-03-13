import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'lw_hide_game_toasts';

interface ToastPreferencesContextType {
  hideGameToasts: boolean;
  setHideGameToasts: (value: boolean) => void;
}

const ToastPreferencesContext = createContext<ToastPreferencesContextType | undefined>(undefined);

export const ToastPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [hideGameToasts, setHideGameToastsState] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setHideGameToastsState(stored === 'true');
    } catch {
      // ignore
    }
  }, []);

  const setHideGameToasts = useCallback((value: boolean) => {
    setHideGameToastsState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
  }, []);

  return (
    <ToastPreferencesContext.Provider value={{ hideGameToasts, setHideGameToasts }}>
      {children}
    </ToastPreferencesContext.Provider>
  );
};

export const useToastPreferences = () => {
  const context = useContext(ToastPreferencesContext);
  if (!context) throw new Error('useToastPreferences must be used within ToastPreferencesProvider');
  return context;
};
