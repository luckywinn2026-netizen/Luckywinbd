import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, Phone, MapPin, User, Send, CheckCircle, MessageCircle, CreditCard, Camera, Image, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().min(10, 'Enter a valid phone number').max(15),
  whatsapp: z.string().trim().min(10, 'Enter a valid WhatsApp number').max(15),
  location: z.string().trim().min(2, 'Enter your location').max(200),
  nid_number: z.string().trim().min(10, 'Enter a valid NID number').max(20),
  message: z.string().trim().max(500).optional(),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ImageUploadField = ({ label, icon: Icon, value, onChange, hint }: {
  label: string;
  icon: React.ElementType;
  value: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = value ? URL.createObjectURL(value) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be under 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    onChange(file);
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5 font-medium">
        <Icon size={12} /> {label}
      </label>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
      {preview ? (
        <div className="relative group">
          <img src={preview} alt={label} className="w-full h-36 object-cover rounded-xl border border-border" />
          <button
            type="button"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
        >
          <Icon size={24} />
          <span className="text-[11px] font-medium">Click to upload</span>
          {hint && <span className="text-[9px] opacity-60">{hint}</span>}
        </button>
      )}
    </div>
  );
};

const InputField = ({ label, icon: Icon, error, children }: {
  label: string;
  icon: React.ElementType;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5 font-medium">
      <Icon size={12} /> {label}
    </label>
    {children}
    {error && <p className="text-destructive text-xs mt-1">{error}</p>}
  </div>
);

const inputClasses = "w-full bg-secondary/60 rounded-xl px-4 py-3 text-foreground font-heading outline-none border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm";

const BecomeAgentPage = () => {
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', location: '', nid_number: '', message: '' });
  const [nidFront, setNidFront] = useState<File | null>(null);
  const [nidBack, setNidBack] = useState<File | null>(null);
  const [livePhoto, setLivePhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('agent-documents').upload(path, file);
    if (error) { console.error('Upload error:', error); return null; }
    const { data } = supabase.storage.from('agent-documents').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!nidFront) { toast.error('Please upload NID front photo'); return; }
    if (!nidBack) { toast.error('Please upload NID back photo'); return; }
    if (!livePhoto) { toast.error('Please upload your live selfie'); return; }

    setLoading(true);

    const { data: existing } = await supabase
      .from('agent_applications')
      .select('id')
      .eq('phone', result.data.phone)
      .in('status', ['pending', 'approved'])
      .limit(1);

    if (existing && existing.length > 0) {
      toast.error('An application already exists for this phone number');
      setLoading(false);
      return;
    }

    const [frontUrl, backUrl, photoUrl] = await Promise.all([
      uploadFile(nidFront, 'nid-front'),
      uploadFile(nidBack, 'nid-back'),
      uploadFile(livePhoto, 'live-photo'),
    ]);

    if (!frontUrl || !backUrl || !photoUrl) {
      toast.error('Failed to upload images');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('agent_applications').insert({
      name: result.data.name,
      phone: result.data.phone,
      whatsapp: result.data.whatsapp,
      location: result.data.location,
      nid_number: result.data.nid_number,
      nid_front_url: frontUrl,
      nid_back_url: backUrl,
      live_photo_url: photoUrl,
      message: result.data.message || null,
    });

    if (error) {
      toast.error('Failed to submit application');
      console.error(error);
    } else {
      setSubmitted(true);
      toast.success('Application submitted successfully!');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen navy-gradient flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card rounded-2xl p-8 gold-border card-glow max-w-md w-full text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="font-heading font-bold text-2xl gold-text mb-2">Application Submitted!</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Your application has been submitted successfully. Our team will contact you shortly.
          </p>
          <p className="text-xs text-muted-foreground">Review is usually completed within 24-48 hours.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen min-h-[100dvh] overflow-y-auto navy-gradient p-4 py-8">
      <div className="min-h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl gold-border card-glow max-w-2xl w-full overflow-hidden"
        >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <UserPlus size={28} className="text-primary" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-2xl gold-text">Become an Agent</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Join our team and earn commission</p>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { icon: '💰', label: 'Earn Commission', desc: 'Per transaction' },
              { icon: '📱', label: 'Mobile Work', desc: 'From anywhere' },
              { icon: '⏰', label: 'Flexible Hours', desc: '24/7 opportunity' },
            ].map(b => (
              <div key={b.label} className="bg-secondary/50 rounded-xl p-3 text-center border border-border/50">
                <span className="text-xl">{b.icon}</span>
                <p className="text-xs font-heading font-bold mt-1">{b.label}</p>
                <p className="text-[9px] text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {/* Section: Personal Info */}
          <div>
            <h3 className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User size={12} /> Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Full Name" icon={User} error={errors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className={inputClasses}
                  placeholder="Your full name"
                  required
                />
              </InputField>
              <InputField label="Location / Area" icon={MapPin} error={errors.location}>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className={inputClasses}
                  placeholder="e.g. Dhaka, Mirpur"
                  required
                />
              </InputField>
            </div>
          </div>

          {/* Section: Contact */}
          <div>
            <h3 className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Phone size={12} /> Contact Info
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Phone Number" icon={Phone} error={errors.phone}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className={inputClasses}
                  placeholder="01XXXXXXXXX"
                  required
                />
              </InputField>
              <InputField label="WhatsApp Number" icon={MessageCircle} error={errors.whatsapp}>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={e => setForm({ ...form, whatsapp: e.target.value })}
                  className={inputClasses}
                  placeholder="01XXXXXXXXX"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">Login credentials will be sent to this number</p>
              </InputField>
            </div>
          </div>

          {/* Section: Identity Verification */}
          <div>
            <h3 className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield size={12} /> Identity Verification
            </h3>
            <div className="space-y-4">
              <InputField label="NID Number" icon={CreditCard} error={errors.nid_number}>
                <input
                  type="text"
                  value={form.nid_number}
                  onChange={e => setForm({ ...form, nid_number: e.target.value })}
                  className={inputClasses}
                  placeholder="Your National ID number"
                  required
                />
              </InputField>
              <div className="grid grid-cols-2 gap-4">
                <ImageUploadField label="NID Front" icon={Image} value={nidFront} onChange={setNidFront} hint="Front side photo" />
                <ImageUploadField label="NID Back" icon={Image} value={nidBack} onChange={setNidBack} hint="Back side photo" />
              </div>
              <ImageUploadField label="Live Photo (Selfie)" icon={Camera} value={livePhoto} onChange={setLivePhoto} hint="Take a clear selfie" />
            </div>
          </div>

          {/* Optional message */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Additional Info (Optional)</label>
            <textarea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              rows={3}
              className={inputClasses + ' resize-none'}
              placeholder="Share your experience or any questions..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-heading font-bold gold-gradient text-primary-foreground active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg"
          >
            <Send size={18} />
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>

          <p className="text-center text-[10px] text-muted-foreground">
            By submitting, you agree to our terms and conditions
          </p>
        </form>
        </motion.div>
      </div>
    </div>
  );
};

export default BecomeAgentPage;