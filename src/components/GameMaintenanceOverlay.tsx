import { motion } from 'framer-motion';
import { Wrench, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  gameName: string;
  backPath?: string;
}

export default function GameMaintenanceOverlay({ gameName, backPath = '/' }: Props) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
    >
      <div className="bg-card rounded-2xl gold-border p-8 max-w-sm text-center space-y-6 mx-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Wrench size={32} className="text-amber-500" />
          </div>
        </div>
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">{gameName}</h2>
          <p className="text-sm text-muted-foreground mt-1">Under Maintenance</p>
          <p className="text-xs text-muted-foreground mt-2">We are updating this game. Please check back soon.</p>
        </div>
        <button
          onClick={() => navigate(backPath)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gold-gradient font-heading font-bold text-primary-foreground"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      </div>
    </motion.div>
  );
}
