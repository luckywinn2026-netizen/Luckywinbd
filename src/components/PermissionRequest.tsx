import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const PERM_STORAGE_KEY = 'luckywin_permissions_requested';

export default function PermissionRequest() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (localStorage.getItem(PERM_STORAGE_KEY) === 'true') return;
    setShow(true);
  }, []);

  const requestNotifications = async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const status = await PushNotifications.checkPermissions();
      if (status.receive === 'prompt') await PushNotifications.requestPermissions();
    } catch {}
  };

  const requestLocation = async () => {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      await Geolocation.getCurrentPosition({ enableHighAccuracy: false }).catch(() => {});
    } catch {}
  };

  const handleAllow = async () => {
    if (step === 0) await requestNotifications();
    if (step === 1) await requestLocation();
    if (step >= 1) {
      localStorage.setItem(PERM_STORAGE_KEY, 'true');
      setShow(false);
    } else {
      setStep(1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(PERM_STORAGE_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  const labels = [
    'Notifications – for offers, bonuses and updates',
    'Location – for nearby features and better experience',
  ];
  const label = labels[step] || labels[0];

  return (
    <Dialog open={show} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="gold-text">Allow Permissions</DialogTitle>
          <DialogDescription>
            {label}
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              Contacts, microphone and other permissions will be requested when needed.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSkip}>
            Skip
          </Button>
          <Button onClick={handleAllow} className="gold-gradient">
            Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
