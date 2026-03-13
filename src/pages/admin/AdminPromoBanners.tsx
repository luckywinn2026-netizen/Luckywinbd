import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

function fixBannerImageUrl(url: string): string {
  if (!url) return url;
  if (url.includes('/object/') && !url.includes('/object/public/')) {
    return url.replace('/storage/v1/object/', '/storage/v1/object/public/');
  }
  return url;
}
import { ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface PromoBanner {
  id: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const AdminPromoBanners = () => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const fetchBanners = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await (supabase as any)
      .from('promo_banners')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      toast.error(error.message);
      setBanners([]);
    } else {
      setBanners((data || []) as PromoBanner[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Select an image first');
      return;
    }
    setUploading('new');
    try {
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('promo-banners')
        .upload(path, uploadFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Explicit public URL format (required for public buckets)
      const base = SUPABASE_URL.replace(/\/$/, '');
      const imageUrl = `${base}/storage/v1/object/public/promo-banners/${path}?t=${Date.now()}`;

      const maxOrder = banners.length > 0 ? Math.max(...banners.map(b => b.sort_order)) : 0;

      const { error: insertError } = await supabase
        .from('promo_banners')
        .insert({
          image_url: imageUrl,
          link_url: newLinkUrl.trim() || null,
          sort_order: maxOrder + 1,
          is_active: true,
        });

      if (insertError) throw insertError;

      toast.success('Banner added!');
      setShowAddModal(false);
      setUploadFile(null);
      setNewLinkUrl('');
      fetchBanners();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const toggleActive = async (banner: PromoBanner) => {
    const { error } = await supabase
      .from('promo_banners')
      .update({ is_active: !banner.is_active })
      .eq('id', banner.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(banner.is_active ? 'Banner hidden' : 'Banner visible');
    fetchBanners();
  };

  const deleteBanner = async (banner: PromoBanner) => {
    if (!confirm('Delete this banner?')) return;
    setUploading(banner.id);
    try {
      const { error } = await supabase.from('promo_banners').delete().eq('id', banner.id);
      if (error) throw error;
      toast.success('Banner deleted');
      fetchBanners();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  };

  const moveBanner = async (banner: PromoBanner, direction: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === banner.id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;

    const swap = banners[swapIdx];
    await Promise.all([
      supabase.from('promo_banners').update({ sort_order: swap.sort_order }).eq('id', banner.id),
      supabase.from('promo_banners').update({ sort_order: banner.sort_order }).eq('id', swap.id),
    ]);
    fetchBanners();
  };

  return (
    <div className="p-3 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl">🖼️ Promo Banners</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage home page promotional banners. Add/edit/delete and reorder.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gold-gradient text-primary-foreground font-heading font-bold"
        >
          <Plus size={18} />
          Add Banner
        </button>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl p-12 gold-border text-center text-muted-foreground">Loading...</div>
      ) : banners.length === 0 ? (
        <div className="bg-card rounded-xl p-12 gold-border text-center">
          <ImageIcon size={48} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-heading">No banners yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a banner to show on the home page</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-sm"
          >
            Add First Banner
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {banners.map((banner, i) => (
              <motion.div
                key={banner.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-card rounded-xl gold-border overflow-hidden flex"
              >
                <div className="flex flex-col justify-center gap-1 p-2 bg-secondary/50">
                  <button
                    onClick={() => moveBanner(banner, 'up')}
                    disabled={i === 0}
                    className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                  >
                    ▲
                  </button>
                  <span className="text-[10px] font-heading w-4 text-center">{i + 1}</span>
                  <button
                    onClick={() => moveBanner(banner, 'down')}
                    disabled={i === banners.length - 1}
                    className="p-0.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                  >
                    ▼
                  </button>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-4 p-3">
                  <div className="w-24 h-14 rounded-lg overflow-hidden bg-secondary shrink-0">
                    {banner.image_url ? (
                      <img src={fixBannerImageUrl(banner.image_url)} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={24} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {banner.link_url || 'No link'}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading ${banner.is_active ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                      {banner.is_active ? 'Visible' : 'Hidden'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 p-2">
                  <button
                    onClick={() => toggleActive(banner)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-heading ${banner.is_active ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}
                  >
                    {banner.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => deleteBanner(banner)}
                    disabled={uploading === banner.id}
                    className="p-2 rounded-lg hover:bg-destructive/20 text-destructive disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => !uploading && setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto bg-card rounded-2xl gold-border p-4 md:p-6 mx-4"
            >
              <h2 className="font-heading font-bold text-lg mb-4">Add Promo Banner</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-heading text-muted-foreground mb-1">Image</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-secondary/50 transition-colors">
                    <Upload size={24} className="text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">
                      {uploadFile ? uploadFile.name : 'Click to select image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-heading text-muted-foreground mb-1">Link URL (optional)</label>
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    placeholder="e.g. /promotions or https://..."
                    className="w-full bg-secondary rounded-xl px-3 py-2.5 outline-none gold-border"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={uploading !== null}
                  className="flex-1 px-4 py-2 rounded-xl bg-secondary gold-border">
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading !== null || !uploadFile}
                  className="flex-1 px-4 py-2 rounded-xl gold-gradient text-primary-foreground font-heading font-bold"
                >
                  {uploading ? 'Uploading...' : 'Add Banner'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPromoBanners;
