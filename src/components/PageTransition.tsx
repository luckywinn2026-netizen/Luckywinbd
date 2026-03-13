import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const PageTransition = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setLoading(true);
    setProgress(0);

    const t1 = setTimeout(() => setProgress(40), 50);
    const t2 = setTimeout(() => setProgress(70), 150);
    const t3 = setTimeout(() => setProgress(90), 250);
    const t4 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setLoading(false), 150);
    }, 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 h-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="h-full gold-gradient rounded-r-full shadow-[0_0_10px_hsl(var(--primary)/0.6)]"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageTransition;
