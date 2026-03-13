import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Trash2, ImageIcon, Music, Paintbrush, ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';

interface GameAssetRow {
  id: string;
  game_id: string;
  asset_type: string;
  asset_key: string;
  asset_url: string;
  label: string | null;
  sort_order: number;
}

interface GameRow {
  id: string;
  game_id: string;
  name: string;
  emoji: string;
  game_type: string;
}

// Game-specific symbol keys for admin asset management
const GAME_SYMBOL_KEYS: Record<string, string[]> = {
  'sweet-bonanza': ['wild', 'scatter', 'boxer', 'trophy', 'gloves', 'A', 'K', 'Q', 'J', '10'],
  'super-ace': ['ace', 'king', 'queen', 'jack', 'diamond', 'spade', 'heart', 'club', 'joker', 'scatter'],
  'classic-777': ['777', 'bar3', 'bar2', 'bar1', 'cherry', 'bell', 'diamond', 'star'],
  'fortune-gems': ['blue', 'red', 'purple', 'green', 'star'],
};
const DEFAULT_SYMBOL_KEYS = ['ace', 'king', 'queen', 'jack', 'diamond', 'spade', 'heart', 'club', 'joker', 'scatter'];

const AdminGameAssets = () => {
  const [games, setGames] = useState<GameRow[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameRow | null>(null);
  const [assets, setAssets] = useState<GameAssetRow[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [tab, setTab] = useState<'symbols' | 'background' | 'music' | 'mascot'>('symbols');

  const fetchGames = useCallback(async () => {
    const { data } = await supabase.from('games').select('id, game_id, name, emoji, game_type').order('sort_order');
    if (data) setGames(data as GameRow[]);
  }, []);

  const fetchAssets = useCallback(async (gameId: string) => {
    const { data } = await supabase
      .from('game_assets')
      .select('*')
      .eq('game_id', gameId)
      .order('sort_order');
    if (data) setAssets(data as GameAssetRow[]);
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  useEffect(() => {
    if (selectedGame) fetchAssets(selectedGame.game_id);
  }, [selectedGame, fetchAssets]);

  const uploadAsset = async (file: File, assetType: string, assetKey: string, label?: string) => {
    if (!selectedGame) return;
    setUploading(assetKey);

    try {
      const ext = file.name.split('.').pop();
      const path = `${selectedGame.game_id}/${assetType}/${assetKey}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('game-assets')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('game-assets').getPublicUrl(path);
      const url = urlData.publicUrl + '?t=' + Date.now();

      // Upsert into game_assets table
      const { error: dbError } = await supabase
        .from('game_assets')
        .upsert({
          game_id: selectedGame.game_id,
          asset_type: assetType,
          asset_key: assetKey,
          asset_url: url,
          label: label || assetKey,
        }, { onConflict: 'game_id,asset_type,asset_key' });

      if (dbError) throw dbError;

      toast.success(`${assetKey} uploaded!`);
      fetchAssets(selectedGame.game_id);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const deleteAsset = async (asset: GameAssetRow) => {
    try {
      await supabase.from('game_assets').delete().eq('id', asset.id);
      // Also delete from storage
      const pathParts = asset.asset_url.split('/game-assets/')[1]?.split('?')[0];
      if (pathParts) {
        await supabase.storage.from('game-assets').remove([pathParts]);
      }
      toast.success('Asset deleted');
      if (selectedGame) fetchAssets(selectedGame.game_id);
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const symbolAssets = assets.filter(a => a.asset_type === 'symbol');
  const bgAsset = assets.find(a => a.asset_type === 'background');
  const musicAsset = assets.find(a => a.asset_type === 'music');
  const mascotAsset = assets.find(a => a.asset_type === 'mascot');

  if (!selectedGame) {
    return (
      <div className="p-3 md:p-6 space-y-5">
        <h1 className="font-heading font-bold text-2xl">🎨 Game Asset Manager</h1>
        <p className="text-muted-foreground text-sm">Select a game to manage its icons, background, and music.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game)}
              className="bg-card gold-border rounded-xl p-4 text-center hover:ring-2 hover:ring-primary/50 transition-all"
            >
              <span className="text-2xl">{game.emoji}</span>
              <p className="font-heading font-bold text-sm mt-2">{game.name}</p>
              <p className="text-[10px] text-muted-foreground">{game.game_type}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedGame(null)} className="p-2 rounded-lg hover:bg-secondary">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-heading font-bold text-xl">{selectedGame.emoji} {selectedGame.name} — Assets</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'symbols' as const, label: '🖼️ Icons/Symbols', icon: ImageIcon },
          { key: 'background' as const, label: '🎨 Background', icon: Paintbrush },
          { key: 'music' as const, label: '🎵 Music', icon: Music },
          { key: 'mascot' as const, label: '🥊 Mascot/Hero', icon: User },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg font-heading font-bold text-xs transition-colors ${
              tab === t.key ? 'gold-gradient text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Symbols Tab */}
      {tab === 'symbols' && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">Upload custom symbol icons. These will replace the default game icons.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(GAME_SYMBOL_KEYS[selectedGame.game_id] || DEFAULT_SYMBOL_KEYS).map(key => {
              const existing = symbolAssets.find(a => a.asset_key === key);
              return (
                <div key={key} className="bg-card gold-border rounded-xl p-3 text-center space-y-2">
                  <p className="font-heading font-bold text-xs uppercase">{key}</p>
                  <div className="w-16 h-16 mx-auto bg-secondary rounded-lg flex items-center justify-center overflow-hidden">
                    {existing ? (
                      <img src={existing.asset_url} alt={key} className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon size={24} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex gap-1 justify-center">
                    <label className="bg-primary/20 hover:bg-primary/30 text-primary px-2 py-1 rounded text-[10px] font-heading font-bold cursor-pointer transition-colors">
                      <Upload size={10} className="inline mr-1" />
                      {uploading === key ? '...' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) uploadAsset(e.target.files[0], 'symbol', key); }}
                        disabled={uploading === key}
                      />
                    </label>
                    {existing && (
                      <button onClick={() => deleteAsset(existing)}
                        className="bg-destructive/20 hover:bg-destructive/30 text-destructive px-2 py-1 rounded text-[10px]">
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Background Tab */}
      {tab === 'background' && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">Upload a custom background image for this game.</p>
          <div className="bg-card gold-border rounded-xl p-5">
            <div className="w-full max-w-md mx-auto aspect-video bg-secondary rounded-lg flex items-center justify-center overflow-hidden">
              {bgAsset ? (
                <img src={bgAsset.asset_url} alt="Background" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Paintbrush size={32} className="mx-auto mb-2" />
                  <p className="text-xs">No custom background</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-center mt-4">
              <label className="gold-gradient text-primary-foreground px-4 py-2 rounded-lg text-xs font-heading font-bold cursor-pointer">
                <Upload size={12} className="inline mr-1" />
                {uploading === 'background' ? 'Uploading...' : 'Upload Background'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadAsset(e.target.files[0], 'background', 'main'); }}
                  disabled={uploading === 'background'}
                />
              </label>
              {bgAsset && (
                <button onClick={() => deleteAsset(bgAsset)}
                  className="bg-destructive/20 hover:bg-destructive/30 text-destructive px-4 py-2 rounded-lg text-xs font-heading font-bold">
                  <Trash2 size={12} className="inline mr-1" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Music Tab */}
      {tab === 'music' && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">Upload background music (MP3/WAV). It will play during gameplay.</p>
          <div className="bg-card gold-border rounded-xl p-5">
            {musicAsset ? (
              <div className="text-center space-y-3">
                <Music size={32} className="mx-auto text-primary" />
                <p className="text-xs text-foreground font-heading font-bold">Music uploaded</p>
                <audio controls src={musicAsset.asset_url} className="mx-auto" />
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Music size={32} className="mx-auto mb-2" />
                <p className="text-xs">No custom music</p>
              </div>
            )}
            <div className="flex gap-2 justify-center mt-4">
              <label className="gold-gradient text-primary-foreground px-4 py-2 rounded-lg text-xs font-heading font-bold cursor-pointer">
                <Upload size={12} className="inline mr-1" />
                {uploading === 'music' ? 'Uploading...' : 'Upload Music'}
                <input type="file" accept="audio/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadAsset(e.target.files[0], 'music', 'bgm'); }}
                  disabled={uploading === 'music'}
                />
              </label>
              {musicAsset && (
                <button onClick={() => deleteAsset(musicAsset)}
                  className="bg-destructive/20 hover:bg-destructive/30 text-destructive px-4 py-2 rounded-lg text-xs font-heading font-bold">
                  <Trash2 size={12} className="inline mr-1" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mascot Tab */}
      {tab === 'mascot' && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">Upload a custom mascot/hero image (e.g. Boxer Hero). Use a transparent PNG for best results.</p>
          <div className="bg-card gold-border rounded-xl p-5">
            <div className="w-40 h-40 mx-auto bg-secondary rounded-lg flex items-center justify-center overflow-hidden">
              {mascotAsset ? (
                <img src={mascotAsset.asset_url} alt="Mascot" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <User size={32} className="mx-auto mb-2" />
                  <p className="text-xs">No custom mascot</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-center mt-4">
              <label className="gold-gradient text-primary-foreground px-4 py-2 rounded-lg text-xs font-heading font-bold cursor-pointer">
                <Upload size={12} className="inline mr-1" />
                {uploading === 'mascot' ? 'Uploading...' : 'Upload Mascot'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) uploadAsset(e.target.files[0], 'mascot', 'hero'); }}
                  disabled={uploading === 'mascot'}
                />
              </label>
              {mascotAsset && (
                <button onClick={() => deleteAsset(mascotAsset)}
                  className="bg-destructive/20 hover:bg-destructive/30 text-destructive px-4 py-2 rounded-lg text-xs font-heading font-bold">
                  <Trash2 size={12} className="inline mr-1" /> Remove
                </button>
              )}
            </div>

            {/* Size Control */}
            {mascotAsset && (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-heading font-bold text-center">Mascot Size: {mascotAsset.label && !isNaN(Number(mascotAsset.label)) ? mascotAsset.label : '128'}px</p>
                <input
                  type="range"
                  min={48}
                  max={320}
                  step={8}
                  value={mascotAsset.label && !isNaN(Number(mascotAsset.label)) ? Number(mascotAsset.label) : 128}
                  onChange={async (e) => {
                    const newSize = e.target.value;
                    await supabase.from('game_assets').update({ label: newSize }).eq('id', mascotAsset.id);
                    if (selectedGame) fetchAssets(selectedGame.game_id);
                  }}
                  className="w-full max-w-xs mx-auto block accent-primary"
                />
                <p className="text-[10px] text-muted-foreground text-center">Small (48px) ← → Large (320px)</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGameAssets;
