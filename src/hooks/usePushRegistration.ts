import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import * as api from '@/lib/api';

const APP_VARIANT = (import.meta.env.VITE_APP_VARIANT as 'user' | 'admin' | 'agent') || 'user';

/**
 * Registers FCM token with backend when user is logged in and app is agent/admin.
 * Call from Agent or Admin layout after auth.
 */
export function usePushRegistration(userId: string | undefined) {
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return;
    if (APP_VARIANT !== 'agent' && APP_VARIANT !== 'admin') return;
    if (!api.isBackendConfigured()) return;

    let cancelled = false;

    const register = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const { status } = await PushNotifications.checkPermissions();
        if (status.receive !== 'granted') return;

        PushNotifications.addListener(
          'registration',
          async (ev) => {
            const token = ev.value;
            if (!token || cancelled || registeredRef.current === token) return;
            registeredRef.current = token;
            try {
              await api.registerPushToken({
                fcm_token: token,
                platform: Capacitor.getPlatform(),
                app_variant: APP_VARIANT,
              });
            } catch {}
          }
        );

        await PushNotifications.register();
      } catch {}
    };

    register();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
