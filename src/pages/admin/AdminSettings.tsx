import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight, Upload, X, Edit2, Save } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface TransactionType {
  id: string;
  type_id: string;
  label: string;
  icon: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  icon_url: string | null;
  number: string;
  color_from: string;
  color_to: string;
  bonus: string | null;
  is_active: boolean;
  sort_order: number;
}

interface MethodNumber {
  id: string;
  payment_method_id: string;
  transaction_type_id: string;
  number: string;
}

const EMPTY_FORM = {
  name: '',
  icon: '💰',
  number: '',
  bonus: '+2.25%',
  color_from: 'hsl(340,80%,40%)',
  color_to: 'hsl(340,80%,55%)',
};

const AdminSettings = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingIconId, setUploadingIconId] = useState<string | null>(null);

  // Transaction Types
  const [txnTypes, setTxnTypes] = useState<TransactionType[]>([]);
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState<TransactionType | null>(null);
  const [txnForm, setTxnForm] = useState({ type_id: '', label: '', icon: '💳', description: '' });

  // Method Numbers per txn type
  const [methodNumbers, setMethodNumbers] = useState<MethodNumber[]>([]);
  const [numberEdits, setNumberEdits] = useState<Record<string, string>>({});
  const [savingNumbers, setSavingNumbers] = useState(false);

  useEffect(() => { fetchMethods(); fetchTxnTypes(); fetchMethodNumbers(); }, []);

  const fetchMethods = async () => {
    const { data } = await supabase.from('payment_methods').select('*').order('sort_order');
    if (data) setMethods(data);
  };

  const fetchTxnTypes = async () => {
    const { data } = await supabase.from('transaction_types').select('*').order('sort_order');
    if (data) setTxnTypes(data as TransactionType[]);
  };

  const fetchMethodNumbers = async () => {
    const { data } = await supabase.from('payment_method_numbers').select('*');
    if (data) {
      setMethodNumbers(data as MethodNumber[]);
      const edits: Record<string, string> = {};
      data.forEach((mn: any) => {
        edits[`${mn.payment_method_id}__${mn.transaction_type_id}`] = mn.number;
      });
      setNumberEdits(edits);
    }
  };

  // ---- Payment Methods CRUD ----
  const openAddModal = () => { setEditingMethod(null); setForm(EMPTY_FORM); setShowModal(true); };

  const openEditModal = (m: PaymentMethod) => {
    setEditingMethod(m);
    setForm({ name: m.name, icon: m.icon, number: m.number, bonus: m.bonus || '', color_from: m.color_from, color_to: m.color_to });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.number.trim()) { toast.error('Name and Number are required'); return; }
    setSaving(true);
    if (editingMethod) {
      const { error } = await supabase.from('payment_methods').update({
        name: form.name.trim(), icon: form.icon.trim(), number: form.number.trim(),
        bonus: form.bonus.trim() || null, color_from: form.color_from.trim(), color_to: form.color_to.trim(),
      }).eq('id', editingMethod.id);
      if (error) { toast.error('Update failed'); setSaving(false); return; }
      toast.success(`${form.name} updated!`);
    } else {
      const { error } = await supabase.from('payment_methods').insert({
        name: form.name.trim(), icon: form.icon.trim(), number: form.number.trim(),
        bonus: form.bonus.trim() || null, color_from: form.color_from.trim(), color_to: form.color_to.trim(),
        sort_order: methods.length + 1,
      });
      if (error) { toast.error('Failed to add'); setSaving(false); return; }
      toast.success(`${form.name} added!`);
    }
    setSaving(false); setShowModal(false); fetchMethods();
  };

  const toggleActive = async (m: PaymentMethod) => {
    await supabase.from('payment_methods').update({ is_active: !m.is_active }).eq('id', m.id);
    toast.success(`${m.name} ${!m.is_active ? 'activated' : 'deactivated'}`); fetchMethods();
  };

  const deleteMethod = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    toast.success('Deleted'); fetchMethods();
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, methodId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only images allowed'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
    setUploadingIconId(methodId);
    const ext = file.name.split('.').pop();
    const path = `${methodId}.${ext}`;
    await supabase.storage.from('payment-icons').remove([path]);
    const { error: uploadErr } = await supabase.storage.from('payment-icons').upload(path, file, { upsert: true });
    if (uploadErr) { toast.error('Upload failed'); setUploadingIconId(null); return; }
    const { data: urlData } = supabase.storage.from('payment-icons').getPublicUrl(path);
    const iconUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from('payment_methods').update({ icon_url: iconUrl }).eq('id', methodId);
    toast.success('Icon updated!'); setUploadingIconId(null); fetchMethods();
  };

  const updateField = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));

  // ---- Transaction Types CRUD ----
  const openAddTxnModal = () => {
    setEditingTxn(null); setTxnForm({ type_id: '', label: '', icon: '💳', description: '' }); setShowTxnModal(true);
  };

  const openEditTxnModal = (t: TransactionType) => {
    setEditingTxn(t); setTxnForm({ type_id: t.type_id, label: t.label, icon: t.icon, description: t.description }); setShowTxnModal(true);
  };

  const saveTxnType = async () => {
    if (!txnForm.type_id.trim() || !txnForm.label.trim()) { toast.error('Enter ID and Label'); return; }
    if (editingTxn) {
      await supabase.from('transaction_types').update({
        label: txnForm.label.trim(), icon: txnForm.icon.trim(), description: txnForm.description.trim(),
      }).eq('id', editingTxn.id);
      toast.success('Updated!');
    } else {
      await supabase.from('transaction_types').insert({
        type_id: txnForm.type_id.trim(), label: txnForm.label.trim(),
        icon: txnForm.icon.trim(), description: txnForm.description.trim(),
        sort_order: txnTypes.length + 1,
      });
      toast.success('Added!');
    }
    setShowTxnModal(false); fetchTxnTypes();
  };

  const toggleTxnActive = async (t: TransactionType) => {
    await supabase.from('transaction_types').update({ is_active: !t.is_active }).eq('id', t.id);
    toast.success(`${t.label} ${!t.is_active ? 'activated' : 'deactivated'}`); fetchTxnTypes();
  };

  const deleteTxnType = async (t: TransactionType) => {
    if (!confirm(`Delete "${t.label}"?`)) return;
    await supabase.from('transaction_types').delete().eq('id', t.id);
    toast.success('Deleted'); fetchTxnTypes();
  };

  // ---- Method Numbers per Txn Type ----
  const handleNumberEdit = (methodId: string, txnTypeId: string, value: string) => {
    setNumberEdits(prev => ({ ...prev, [`${methodId}__${txnTypeId}`]: value }));
  };

  const saveMethodNumbers = async () => {
    setSavingNumbers(true);
    const upserts: { payment_method_id: string; transaction_type_id: string; number: string }[] = [];

    for (const [key, number] of Object.entries(numberEdits)) {
      if (!number.trim()) continue;
      const [payment_method_id, transaction_type_id] = key.split('__');
      upserts.push({ payment_method_id, transaction_type_id, number: number.trim() });
    }

    if (upserts.length === 0) {
      toast.error('No numbers provided');
      setSavingNumbers(false);
      return;
    }

    const { error } = await supabase.from('payment_method_numbers').upsert(upserts, {
      onConflict: 'payment_method_id,transaction_type_id',
    });

    if (error) {
      toast.error('Save failed: ' + error.message);
    } else {
      toast.success('All numbers saved!');
      fetchMethodNumbers();
    }
    setSavingNumbers(false);
  };

  const activeMethodsForNumbers = methods.filter(m => m.is_active);
  const activeTxnTypesForNumbers = txnTypes.filter(t => t.is_active);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <h1 className="font-heading font-bold text-lg md:text-2xl">⚙️ Settings</h1>

      {/* Payment Methods Management */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">💳 Payment Methods</h3>
          <button onClick={openAddModal} className="flex items-center gap-1.5 px-3 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs">
            <Plus size={14} /> Add New
          </button>
        </div>
        <div className="space-y-2">
          {methods.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No payment methods yet</p>}
          {methods.map(m => (
            <div key={m.id} className="flex items-center gap-3 bg-secondary rounded-lg p-3">
              <div className="relative group shrink-0">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${m.color_from}, ${m.color_to})` }}>
                  {m.icon_url ? <img src={m.icon_url} alt={m.name} className="w-full h-full object-cover" /> : m.icon}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  {uploadingIconId === m.id ? <span className="text-[10px] text-white">...</span> : <Upload size={14} className="text-white" />}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleIconUpload(e, m.id)} />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-sm">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">📞 {m.number}</p>
                {m.bonus && <span className="text-[10px] text-primary font-bold">{m.bonus}</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${m.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                {m.is_active ? 'Active' : 'Off'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleActive(m)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors">
                  {m.is_active ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} />}
                </button>
                <button onClick={() => openEditModal(m)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteMethod(m.id, m.name)} className="p-1.5 text-destructive hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Types Management */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">🔄 Transaction Types</h3>
          <button onClick={openAddTxnModal} className="flex items-center gap-1.5 px-3 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs">
            <Plus size={14} /> Add New
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Manage which Transaction Types users see during deposit</p>
        <div className="space-y-2">
          {txnTypes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No transaction types yet</p>}
          {txnTypes.map(t => (
            <div key={t.id} className="flex items-center gap-3 bg-secondary rounded-lg p-3">
              <span className="text-2xl shrink-0">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-sm">{t.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                <p className="text-[9px] text-muted-foreground/60">ID: {t.type_id}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${t.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                {t.is_active ? 'Active' : 'Off'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleTxnActive(t)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors">
                  {t.is_active ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} />}
                </button>
                <button onClick={() => openEditTxnModal(t)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteTxnType(t)} className="p-1.5 text-destructive hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Number per Transaction Type */}
      {activeMethodsForNumbers.length > 0 && activeTxnTypesForNumbers.length > 0 && (
        <div className="bg-card rounded-xl p-4 gold-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-lg flex items-center gap-2">📱 Payment Numbers (Per Type)</h3>
            <button onClick={saveMethodNumbers} disabled={savingNumbers}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg gold-gradient text-primary-foreground font-heading font-bold text-xs disabled:opacity-50">
              <Save size={14} /> {savingNumbers ? 'Saving...' : 'Save All'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Define which number is used for each Payment Method per Transaction Type. Leave empty to show default number.
          </p>

          <div className="space-y-4">
            {activeMethodsForNumbers.map(m => (
              <div key={m.id} className="bg-secondary rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shadow-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${m.color_from}, ${m.color_to})` }}>
                    {m.icon_url ? <img src={m.icon_url} alt={m.name} className="w-full h-full object-cover" /> : m.icon}
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm">{m.name}</p>
                    <p className="text-[9px] text-muted-foreground">Default: {m.number}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {activeTxnTypesForNumbers.map(t => {
                    const key = `${m.id}__${t.id}`;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-sm shrink-0 w-6 text-center">{t.icon}</span>
                        <span className="text-xs text-muted-foreground shrink-0 w-28 truncate">{t.label}</span>
                        <input
                          value={numberEdits[key] || ''}
                          onChange={e => handleNumberEdit(m.id, t.id, e.target.value)}
                          placeholder={m.number}
                          className="flex-1 bg-background rounded-lg px-3 py-2 text-foreground font-heading text-xs outline-none gold-border focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Role Info */}
      <div className="bg-card rounded-xl p-4 gold-border space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={18} className="text-primary" />
          <h3 className="font-heading font-bold">Admin Management</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          To add a new admin, insert a record in the user_roles table with role = 'admin' and the user's ID.
        </p>
        <div className="bg-secondary rounded-lg p-3">
          <code className="text-xs text-foreground">
            INSERT INTO user_roles (user_id, role) VALUES ('user-uuid-here', 'admin');
          </code>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 gold-border space-y-3">
        <h3 className="font-heading font-bold">Platform Info</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Platform</div>
          <div className="font-heading font-bold">Lucky Win BD</div>
          <div className="text-muted-foreground">Version</div>
          <div className="font-heading font-bold">1.0.0</div>
          <div className="text-muted-foreground">Currency</div>
          <div className="font-heading font-bold">৳ (BDT)</div>
        </div>
      </div>

      {/* Payment Method Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
              <div className="px-5 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-bold text-base">{editingMethod ? `✏️ Edit ${editingMethod.name}` : '➕ Add Payment Method'}</h2>
                  <button onClick={() => setShowModal(false)} className="p-1"><X size={20} className="text-muted-foreground" /></button>
                </div>
                <div className="flex items-center gap-3 bg-secondary rounded-xl p-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shadow-md overflow-hidden" style={{ background: `linear-gradient(135deg, ${form.color_from}, ${form.color_to})` }}>
                    {form.icon || '💰'}
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm">{form.name || 'Method Name'}</p>
                    <p className="text-xs text-muted-foreground">{form.number || '01XXXXXXXXX'}</p>
                    {form.bonus && <span className="text-[10px] text-primary font-bold">{form.bonus}</span>}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Method Name *</label>
                    <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. bKash, Nagad, Rocket"
                      className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Icon (Emoji)</label>
                      <input value={form.icon} onChange={e => updateField('icon', e.target.value)} placeholder="💰"
                        className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm text-center text-xl" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Bonus Text</label>
                      <input value={form.bonus} onChange={e => updateField('bonus', e.target.value)} placeholder="+2.25%"
                        className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Default Payment Number *</label>
                    <input value={form.number} onChange={e => updateField('number', e.target.value)} placeholder="01XXXXXXXXX"
                      className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Gradient From</label>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg border border-border shrink-0" style={{ background: form.color_from }} />
                        <input value={form.color_from} onChange={e => updateField('color_from', e.target.value)}
                          className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Gradient To</label>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg border border-border shrink-0" style={{ background: form.color_to }} />
                        <input value={form.color_to} onChange={e => updateField('color_to', e.target.value)}
                          className="w-full bg-secondary rounded-xl px-3 py-2.5 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving}
                  className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform disabled:opacity-50 text-base">
                  {saving ? 'Saving...' : editingMethod ? '✅ Update Method' : '✅ Add Method'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Transaction Type Add/Edit Modal */}
      <AnimatePresence>
        {showTxnModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTxnModal(false)} className="fixed inset-0 bg-black/60 z-40" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
              <div className="px-5 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-bold text-base">{editingTxn ? `✏️ Edit ${editingTxn.label}` : '➕ Add Transaction Type'}</h2>
                  <button onClick={() => setShowTxnModal(false)} className="p-1"><X size={20} className="text-muted-foreground" /></button>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 bg-secondary rounded-xl p-4">
                  <span className="text-3xl">{txnForm.icon || '💳'}</span>
                  <div>
                    <p className="font-heading font-bold text-sm">{txnForm.label || 'Type Name'}</p>
                    <p className="text-[10px] text-muted-foreground">{txnForm.description || 'Description here...'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Type ID * (unique, e.g. send-money)</label>
                    <input value={txnForm.type_id} onChange={e => setTxnForm(p => ({ ...p, type_id: e.target.value }))}
                      placeholder="e.g. agent-cashout" disabled={!!editingTxn}
                      className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Label *</label>
                    <input value={txnForm.label} onChange={e => setTxnForm(p => ({ ...p, label: e.target.value }))}
                      placeholder="e.g. Agent Cashout"
                      className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Icon (Emoji)</label>
                      <input value={txnForm.icon} onChange={e => setTxnForm(p => ({ ...p, icon: e.target.value }))}
                        placeholder="💳"
                        className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm text-center text-xl" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Description</label>
                      <input value={txnForm.description} onChange={e => setTxnForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Short description"
                        className="w-full bg-secondary rounded-xl px-4 py-3 text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary text-sm" />
                    </div>
                  </div>
                </div>

                <button onClick={saveTxnType}
                  className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-95 transition-transform text-base">
                  {editingTxn ? '✅ Update Type' : '✅ Add Type'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSettings;
