import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Smartphone, Share, MoreVertical, PlusSquare, Check } from 'lucide-react';

const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Check size={40} className="text-primary" />
          </div>
          <h1 className="font-heading font-bold text-2xl gold-text mb-2">Added to Home!</h1>
          <p className="text-muted-foreground">Open from your home screen — same online game, quick access.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto space-y-6"
      >
        <div className="text-center pt-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 gold-border">
            <Smartphone size={40} className="text-primary" />
          </div>
          <h1 className="font-heading font-bold text-2xl gold-text">Add to Home Screen</h1>
          <p className="text-muted-foreground text-sm mt-2">
            No APK download — this is an online game. Adding to home gives you an app-like shortcut and faster access.
          </p>
        </div>

        {deferredPrompt ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleInstall}
            className="w-full py-4 rounded-xl font-heading font-bold gold-gradient text-primary-foreground flex items-center justify-center gap-3 text-lg"
          >
            <Download size={24} />
            Add to Home Screen
          </motion.button>
        ) : isIOS ? (
          <div className="bg-card rounded-2xl p-5 gold-border space-y-4">
            <h2 className="font-heading font-bold text-lg text-center">Install on iPhone</h2>
            <div className="space-y-3">
              <Step num={1} icon={<Share size={18} />} text="Tap the Share button in Safari" />
              <Step num={2} icon={<PlusSquare size={18} />} text="Select 'Add to Home Screen'" />
              <Step num={3} icon={<Check size={18} />} text="Tap 'Add' — done!" />
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-5 gold-border space-y-4">
            <h2 className="font-heading font-bold text-lg text-center">Install on Android</h2>
            <div className="space-y-3">
              <Step num={1} icon={<MoreVertical size={18} />} text="Tap the Chrome menu (⋮)" />
              <Step num={2} icon={<PlusSquare size={18} />} text="Select 'Install app' or 'Add to Home Screen'" />
              <Step num={3} icon={<Check size={18} />} text="Tap 'Install' — done!" />
            </div>
          </div>
        )}

        <div className="bg-card/50 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground">
            ✨ Not an APK — game runs online. This adds a home screen shortcut and opens in fullscreen for quick access.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const Step = ({ num, icon, text }: { num: number; icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
      {num}
    </div>
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-sm text-foreground">{text}</span>
  </div>
);

export default InstallPage;
