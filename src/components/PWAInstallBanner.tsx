import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import logo from '@/assets/lucky-win-bd-logo.png';

const PWA_DISMISSED_KEY = 'pwa_install_dismissed';
const PWA_INSTALLED_KEY = 'pwa_installed';

const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      localStorage.setItem(PWA_INSTALLED_KEY, 'true');
      return;
    }
    if (localStorage.getItem(PWA_INSTALLED_KEY) === 'true') return;

    // Don't show if dismissed recently (24h)
    const dismissed = localStorage.getItem(PWA_DISMISSED_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) return;

    // Only show on mobile
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // iOS Safari doesn't fire beforeinstallprompt — show manual guide
      const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/.test(navigator.userAgent);
      if (isSafari) {
        setTimeout(() => setShow(true), 3000);
      }
      return;
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(PWA_INSTALLED_KEY, 'true');
      }
      setDeferredPrompt(null);
    }
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 200, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-3 right-3 z-50 bg-card/95 backdrop-blur-xl rounded-2xl p-4 gold-border card-glow shadow-2xl"
        >
          <button onClick={handleDismiss} className="absolute top-2 right-2 p-1.5 text-muted-foreground">
            <X size={16} />
          </button>

          <div className="flex items-center gap-3">
            <img src={logo} alt="Lucky Win" className="w-12 h-12 rounded-xl" />
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-bold text-sm text-foreground">Add Lucky Win BD to Home</h3>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {isIOS
                  ? 'Tap Share ↗ then "Add to Home Screen" — online game, quick access.'
                  : 'No APK — online game. Add to home for app-like quick access.'}
              </p>
            </div>
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="px-4 py-2 rounded-xl gold-gradient font-heading font-bold text-xs text-primary-foreground active:scale-95 transition-transform flex items-center gap-1.5 shrink-0"
              >
                <Download size={14} />
                Add to Home
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallBanner;
