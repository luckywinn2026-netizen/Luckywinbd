import { toast } from 'sonner';
import { useToastPreferences } from '@/contexts/ToastPreferencesContext';

/**
 * Returns toast that respects user preference for game notifications.
 * When hideGameToasts is true, error and info toasts are suppressed in games.
 * Use like: const gameToast = useGameToast(); gameToast.error('msg'); gameToast.info('msg');
 */
export const useGameToast = () => {
  const { hideGameToasts } = useToastPreferences();

  return {
    error: (msg: string, opts?: Parameters<typeof toast.error>[1]) => {
      if (!hideGameToasts) toast.error(msg, opts);
    },
    info: (msg: string, opts?: Parameters<typeof toast.info>[1]) => {
      if (!hideGameToasts) toast.info(msg, opts);
    },
    success: (msg: string, opts?: Parameters<typeof toast.success>[1]) => {
      if (!hideGameToasts) toast.success(msg, opts);
    },
  };
};
