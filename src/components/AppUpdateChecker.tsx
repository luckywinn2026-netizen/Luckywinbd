import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const BASE = import.meta.env.VITE_API_URL || '';

export default function AppUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<{
    show: boolean;
    force: boolean;
    downloadUrl: string;
    newVersion: string;
  } | null>(null);

  useEffect(() => {
    if (!BASE || !Capacitor.isNativePlatform()) return;

    const check = async () => {
      try {
        const res = await fetch(`${BASE.replace(/\/$/, '')}/api/app-version`);
        if (!res.ok) return;
        const data = await res.json();
        const { version: newVersion, versionCode: serverCode, downloadUrl, forceUpdate } = data;

        const info = await CapApp.getInfo();
        const currentVersion = info.version || '1.0.0';
        const currentCode = parseInt(String(info.build || '0'), 10) || 0;

        const needsUpdate = serverCode > currentCode;
        if (needsUpdate && (downloadUrl || !forceUpdate)) {
          setUpdateInfo({
            show: true,
            force: forceUpdate === true,
            downloadUrl: downloadUrl || '',
            newVersion: newVersion || '1.0.1',
          });
        }
      } catch {
        // ignore
      }
    };

    check();
  }, []);

  const handleUpdate = () => {
    if (updateInfo?.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank');
    }
    if (!updateInfo?.force) setUpdateInfo(null);
  };

  const handleLater = () => {
    if (!updateInfo?.force) setUpdateInfo(null);
  };

  if (!updateInfo?.show) return null;

  return (
    <Dialog open={updateInfo.show} onOpenChange={() => !updateInfo.force && setUpdateInfo(null)}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => updateInfo.force && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="gold-text">🔄 Update Available</DialogTitle>
          <DialogDescription>
            A new version ({updateInfo.newVersion}) is available. Please update for the best experience.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          {!updateInfo.force && (
            <Button variant="outline" onClick={handleLater}>
              Later
            </Button>
          )}
          <Button onClick={handleUpdate} className="gold-gradient">
            Update Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
