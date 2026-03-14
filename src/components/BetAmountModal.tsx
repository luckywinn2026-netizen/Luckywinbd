import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';

interface BetAmountModalProps {
  open: boolean;
  onClose: () => void;
  presets: number[];
  current: number;
  onSelect: (amount: number) => void;
  accentColor?: string;
  disabled?: boolean;
}

const DEFAULT_ACCENT = '#ffd700';

export default function BetAmountModal({
  open,
  onClose,
  presets,
  current,
  onSelect,
  accentColor = DEFAULT_ACCENT,
  disabled = false,
}: BetAmountModalProps) {
  const handleSelect = (amount: number) => {
    if (disabled) return;
    onSelect(amount);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-[300px] rounded-xl p-4"
            style={{
              background: 'linear-gradient(180deg, #1a1200 0%, #0f0a00 50%, #1a1200 100%)',
              border: `2px solid ${accentColor}`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${accentColor}22`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <Coins size={20} style={{ color: accentColor }} />
              <p className="text-sm font-bold" style={{ color: accentColor }}>Select Bet Amount</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {presets.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSelect(amt)}
                  disabled={disabled}
                  className="py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: current === amt
                      ? `linear-gradient(180deg, ${accentColor}, ${accentColor}cc)`
                      : 'linear-gradient(180deg, #2a1a00, #1a0c00)',
                    border: current === amt ? 'none' : `1px solid ${accentColor}`,
                    color: current === amt ? '#1a0c00' : accentColor,
                  }}
                >
                  ৳{amt}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
