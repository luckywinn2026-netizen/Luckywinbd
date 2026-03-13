import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Android hardware back button - navigates back like standard APK apps.
 * Only active when running in Capacitor native app (APK).
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const listenerPromise = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
      } else {
        App.exitApp();
      }
    });

    return () => {
      listenerPromise.then((l) => l.remove());
    };
  }, [navigate]);
}
