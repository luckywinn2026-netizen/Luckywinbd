import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, RotateCcw, Percent } from 'lucide-react';

interface Settings {
  id: string;
  pct_1x: number;
  pct_2x_25x: number;
  pct_100x_500x: number;
  pct_wild: number;
  pct_scatter: number;
}

const LABELS: { key: keyof Omit<Settings, 'id'>; label: string; emoji: string; color: string }[] = [
  { key: 'pct_1x', label: '1x (No Win)', emoji: '1️⃣', color: '#888' },
  { key: 'pct_2x_25x', label: '2x - 25x', emoji: '💰', color: '#ffd700' },
  { key: 'pct_100x_500x', label: '100x - 500x', emoji: '🔥', color: '#ff4444' },
  { key: 'pct_wild', label: 'Wild 🃏', emoji: '🃏', color: '#00ffcc' },
  { key: 'pct_scatter', label: 'Scatter 💫 (Free Spin)', emoji: '💫', color: '#ff00ff' },
];

const AdminMultiplierSettings = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('multiplier_settings' as any)
      .select('*')
      .limit(1)
      .single();
    if (data) setSettings(data as any);
  };

  const totalPct = settings
    ? settings.pct_1x + settings.pct_2x_25x + settings.pct_100x_500x + settings.pct_wild + settings.pct_scatter
    : 0;

  const handleChange = (key: keyof Omit<Settings, 'id'>, value: number) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    if (Math.abs(totalPct - 100) > 0.01) {
      toast.error(`Total must be 100%. Currently: ${totalPct.toFixed(1)}%`);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('multiplier_settings' as any)
      .update({
        pct_1x: settings.pct_1x,
        pct_2x_25x: settings.pct_2x_25x,
        pct_100x_500x: settings.pct_100x_500x,
        pct_wild: settings.pct_wild,
        pct_scatter: settings.pct_scatter,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', settings.id);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Multiplier probabilities updated!');
  };

  const handleReset = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      pct_1x: 90,
      pct_2x_25x: 5,
      pct_100x_500x: 2,
      pct_wild: 2,
      pct_scatter: 1,
    });
  };

  if (!settings) {
    return (
      <div className="p-3 md:p-6 flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      <h1 className="font-heading font-bold text-2xl">🎰 4th Reel Multiplier Control</h1>
      <p className="text-sm text-muted-foreground">
        Control the 4th reel probability for all Slot games from here. Total must equal 100%.
      </p>

      <div className="bg-card rounded-xl p-5 gold-border space-y-5">
        {/* Total indicator */}
        <div className={`flex items-center justify-between p-3 rounded-lg ${Math.abs(totalPct - 100) < 0.01 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          <div className="flex items-center gap-2">
            <Percent size={18} />
            <span className="font-heading font-bold">Total</span>
          </div>
          <span className={`font-heading font-bold text-lg ${Math.abs(totalPct - 100) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPct.toFixed(1)}%
          </span>
        </div>

        {/* Sliders */}
        {LABELS.map(({ key, label, emoji, color }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-heading font-bold flex items-center gap-2">
                <span>{emoji}</span> {label}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={settings[key]}
                  onChange={e => handleChange(key, parseFloat(e.target.value) || 0)}
                  className="w-20 bg-secondary rounded-lg px-2 py-1.5 text-sm text-foreground font-heading font-bold text-center outline-none gold-border"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={settings[key]}
              onChange={e => handleChange(key, parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${color} ${settings[key]}%, #333 ${settings[key]}%)`,
              }}
            />
          </div>
        ))}

        {/* Visual bar */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-heading font-bold">Distribution Preview</p>
          <div className="h-8 rounded-lg overflow-hidden flex">
            {LABELS.map(({ key, color }) => (
              <div
                key={key}
                style={{ width: `${settings[key]}%`, background: color, minWidth: settings[key] > 0 ? 2 : 0 }}
                className="transition-all duration-300"
              />
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {LABELS.map(({ key, label, color }) => (
              <span key={key} className="text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                {label}: {settings[key]}%
              </span>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || Math.abs(totalPct - 100) > 0.01}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground disabled:opacity-50 transition-transform active:scale-95"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-3 rounded-xl font-heading font-bold bg-secondary hover:bg-secondary/80 text-foreground transition-colors flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-2">
        <h3 className="font-heading font-bold text-sm">📋 Notes</h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>These settings apply to all Slot games (Money Coming, T.Fruits, F.Party)</li>
          <li>Changes take effect within 30 seconds across all games</li>
          <li>1x = no multiplier (near miss), 2x-25x = small win</li>
          <li>100x-500x = Big Win, Wild = 5x-50x random, Scatter = 10 Free Spins</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminMultiplierSettings;
