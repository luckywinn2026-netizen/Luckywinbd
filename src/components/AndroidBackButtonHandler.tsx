import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';

/**
 * Handles Android hardware back button - navigates back like standard APK.
 * Renders nothing, only sets up the listener.
 */
export default function AndroidBackButtonHandler() {
  useAndroidBackButton();
  return null;
}
