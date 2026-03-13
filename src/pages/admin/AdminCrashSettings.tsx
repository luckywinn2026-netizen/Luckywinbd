import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plane, Save } from 'lucide-react';

type CrashMode = 'auto' | 'fixed' | 'range';

type CrashGameId = 'aviator' | 'rocket' | 'jet' | 'turbo' | 'multi';

type CrashSettingRow = {
  id: string;
  game_id: CrashGameId;
  mode: CrashMode;
  fixed_crash_point: number | null;
  min_crash: number | null;
  max_crash: number | null;
  house_edge_percent: number | null;
};

const CRASH_GAMES: Array<{ id: CrashGameId; label: string }> = [
  { id: 'aviator', label: 'Aviator' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'jet', label: 'Jet' },
  { id: 'turbo', label: 'Turbo' },
  { id: 'multi', label: 'Multi X' },
];

const DEFAULT_VALUES = {
  mode: 'auto' as CrashMode,
  fixedPoint: '2.00',
  minCrash: '1.01',
  maxCrash: '100',
  houseEdge: '22',
};

const AdminCrashSettings = () => {
  const [selectedGame, setSelectedGame] = useState<CrashGameId>('aviator');
  const [mode, setMode] = useState<CrashMode>(DEFAULT_VALUES.mode);
  const [fixedPoint, setFixedPoint] = useState(DEFAULT_VALUES.fixedPoint);
  const [minCrash, setMinCrash] = useState(DEFAULT_VALUES.minCrash);
  const [maxCrash, setMaxCrash] = useState(DEFAULT_VALUES.maxCrash);
  const [houseEdge, setHouseEdge] = useState(DEFAULT_VALUES.houseEdge);
  const [settingsId, setSettingsId] = useState('');
  const [settingsRows, setSettingsRows] = useState<Record<CrashGameId, CrashSettingRow | null>>({
    aviator: null,
    rocket: null,
    jet: null,
    turbo: null,
    multi: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('crash_settings')
      .select('id, game_id, mode, fixed_crash_point, min_crash, max_crash, house_edge_percent')
      .in('game_id', CRASH_GAMES.map((game) => game.id));

    if (error) {
      toast.error('Failed to load crash settings');
      return;
    }

    const nextRows: Record<CrashGameId, CrashSettingRow | null> = {
      aviator: null,
      rocket: null,
      jet: null,
      turbo: null,
      multi: null,
    };

    (data || []).forEach((row) => {
      if (row.game_id in nextRows) {
        nextRows[row.game_id as CrashGameId] = row as CrashSettingRow;
      }
    });

    setSettingsRows(nextRows);
  };

  const selectedRow = useMemo(() => settingsRows[selectedGame], [selectedGame, settingsRows]);

  useEffect(() => {
    if (!selectedRow) {
      setSettingsId('');
      setMode(DEFAULT_VALUES.mode);
      setFixedPoint(DEFAULT_VALUES.fixedPoint);
      setMinCrash(DEFAULT_VALUES.minCrash);
      setMaxCrash(DEFAULT_VALUES.maxCrash);
      setHouseEdge(DEFAULT_VALUES.houseEdge);
      return;
    }

    setSettingsId(selectedRow.id);
    setMode(selectedRow.mode);
    setFixedPoint(String(selectedRow.fixed_crash_point ?? DEFAULT_VALUES.fixedPoint));
    setMinCrash(String(selectedRow.min_crash ?? DEFAULT_VALUES.minCrash));
    setMaxCrash(String(selectedRow.max_crash ?? DEFAULT_VALUES.maxCrash));
    setHouseEdge(String(selectedRow.house_edge_percent ?? DEFAULT_VALUES.houseEdge));
  }, [selectedRow]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      game_id: selectedGame,
      mode,
      fixed_crash_point: mode === 'fixed' ? Number(fixedPoint) : null,
      min_crash: Number(minCrash),
      max_crash: Number(maxCrash),
      house_edge_percent: Number(houseEdge),
      updated_at: new Date().toISOString(),
    };

    const query = settingsId
      ? supabase.from('crash_settings').update(payload).eq('id', settingsId)
      : supabase.from('crash_settings').insert(payload);

    const { error } = await query;

    setSaving(false);
    if (error) {
      toast.error('Save failed');
      return;
    }

    await fetchSettings();
    toast.success(`${CRASH_GAMES.find((game) => game.id === selectedGame)?.label} settings saved!`);
  };

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Plane size={24} className="text-primary" />
        <h1 className="font-heading font-bold text-2xl">Crash Game Control</h1>
      </div>

      <div className="bg-card rounded-xl gold-border p-4 space-y-4">
        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">Game Selection</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {CRASH_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className={`py-3 rounded-lg font-heading font-bold text-sm transition-colors ${
                selectedGame === game.id ? 'gold-gradient text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {game.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Each crash game now has its own `house_edge_percent`, mode, and crash range.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="bg-card rounded-xl gold-border p-4 space-y-4">
        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">Crash Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['auto', 'fixed', 'range'] as CrashMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-3 rounded-lg font-heading font-bold text-sm transition-colors ${
                mode === m ? 'gold-gradient text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {m === 'auto' ? '🎲 Auto (RTP)' : m === 'fixed' ? '🎯 Fixed Point' : '📊 Range'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === 'auto' && 'Random crash point will be generated based on house edge percentage'}
          {mode === 'fixed' && 'Next round will crash at exactly this multiplier (reverts to auto after one use)'}
          {mode === 'range' && 'Random crash between Min and Max values'}
        </p>
      </div>

      {/* House Edge (always visible) */}
      <div className="bg-card rounded-xl gold-border p-4 space-y-3">
        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">House Edge</h3>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">House Edge %</label>
          <input
            type="number"
            value={houseEdge}
            onChange={e => setHouseEdge(e.target.value)}
            className="w-full bg-secondary rounded-lg px-3 py-2.5 font-heading outline-none focus:ring-2 focus:ring-primary"
            step="0.5"
            min="0"
            max="50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Higher value = game crashes sooner. Default 22% = ~78% RTP.
          </p>
        </div>
      </div>

      {/* Fixed Point */}
      {mode === 'fixed' && (
        <div className="bg-card rounded-xl gold-border p-4 space-y-3">
          <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">Fixed Crash Point</h3>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Crash at (x)</label>
            <input
              type="number"
              value={fixedPoint}
              onChange={e => setFixedPoint(e.target.value)}
              className="w-full bg-secondary rounded-lg px-3 py-2.5 font-heading outline-none focus:ring-2 focus:ring-primary"
              step="0.01"
              min="1.01"
            />
          </div>
          <div className="flex gap-2">
            {[1.05, 1.5, 2.0, 5.0, 10.0].map(v => (
              <button
                key={v}
                onClick={() => setFixedPoint(String(v))}
                className="flex-1 py-2 text-xs font-heading font-bold bg-secondary hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors"
              >
                {v}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Range */}
      {mode === 'range' && (
        <div className="bg-card rounded-xl gold-border p-4 space-y-3">
          <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase tracking-wider">Crash Range</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Min Crash (x)</label>
              <input
                type="number"
                value={minCrash}
                onChange={e => setMinCrash(e.target.value)}
                className="w-full bg-secondary rounded-lg px-3 py-2.5 font-heading outline-none focus:ring-2 focus:ring-primary"
                step="0.01"
                min="1.01"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Max Crash (x)</label>
              <input
                type="number"
                value={maxCrash}
                onChange={e => setMaxCrash(e.target.value)}
                className="w-full bg-secondary rounded-lg px-3 py-2.5 font-heading outline-none focus:ring-2 focus:ring-primary"
                step="0.1"
                min="1.1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-xl font-heading font-bold text-lg gold-gradient text-primary-foreground active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save size={20} />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
};

export default AdminCrashSettings;
