import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, CheckCircle, Users, Gift, TrendingUp, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getBonusRuleNumber } from '@/hooks/useBonusRules';
import { useBonusRules } from '@/hooks/useBonusRules';

interface Referral {
  id: string;
  referred_id: string;
  bonus_earned: number;
  bonus_cap: number;
  status: string;
  created_at: string;
  referred_username?: string;
}

const ReferralPage = () => {
  const navigate = useNavigate();
  const { user, profile, openAuth } = useAuth();
  const { rules: referralRules } = useBonusRules({ triggerTypes: ['referral_deposit_approved'] });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const referralRule = referralRules[0] || null;
  const referralPercent = getBonusRuleNumber(referralRule, 'percent', 50);
  const referralCap = getBonusRuleNumber(referralRule, 'referral_cap', 12500);
  const referralMinDeposit = getBonusRuleNumber(referralRule, 'min_deposit', 0);

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    if (user) fetchReferrals();
  }, [user]);

  const fetchReferrals = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch referred usernames
      const referredIds = data.map(r => r.referred_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', referredIds);

      const enriched = data.map(r => ({
        ...r,
        referred_username: profiles?.find(p => p.user_id === r.referred_id)?.username || 'Unknown',
      }));

      setReferrals(enriched);
      setTotalEarned(data.reduce((sum, r) => sum + Number(r.bonus_earned), 0));
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (!profile?.refer_code) return;
    navigator.clipboard.writeText(profile.refer_code);
    setCopied(true);
    toast.success('Refer code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!profile?.refer_code) return;
    const text = `🎰 Join Lucky Win BD and get bonus! Use my refer code: ${profile.refer_code}\n\nSign up now and win big! 💰`;
    if (navigator.share) {
      navigator.share({ title: 'Lucky Win BD Referral', text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Share text copied!');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen navy-gradient p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="p-2"><ArrowLeft size={22} className="text-foreground" /></button>
          <h1 className="font-heading font-bold text-lg gold-text">👥 Referrals</h1>
        </div>
        <div className="bg-card rounded-2xl p-6 gold-border card-glow text-center">
          <Users size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Sign in to see your referral code and earnings</p>
          <button onClick={() => openAuth('login')} className="px-6 py-3 rounded-xl font-heading font-bold gold-gradient text-primary-foreground">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen navy-gradient">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => navigate(-1)} className="p-2"><ArrowLeft size={22} className="text-foreground" /></button>
        <h1 className="font-heading font-bold text-lg gold-text">👥 My Referrals</h1>
      </div>

      <div className="px-4 space-y-4 pb-6">
        {/* Refer Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-4 gold-border card-glow"
        >
          <p className="text-xs text-muted-foreground mb-1 font-heading">Your Refer Code</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-secondary rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="font-heading font-bold text-lg text-primary tracking-[0.3em]">{profile?.refer_code || '...'}</span>
              <button onClick={handleCopy}>
                {copied ? <CheckCircle size={20} className="text-success" /> : <Copy size={20} className="text-muted-foreground" />}
              </button>
            </div>
            <button onClick={handleShare} className="p-3 rounded-xl gold-gradient active:scale-95 transition-transform">
              <Share2 size={20} className="text-primary-foreground" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Share this code with friends. You get <span className="text-primary font-bold">{referralPercent}% bonus</span> on their deposits (up to ৳{referralCap.toLocaleString()})!
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-3 gold-border text-center">
            <Users size={20} className="text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">Total Referrals</p>
            <p className="font-heading font-bold text-lg text-primary">{referrals.length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-xl p-3 gold-border text-center">
            <Gift size={20} className="text-success mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">Total Earned</p>
            <p className="font-heading font-bold text-lg text-success">৳{totalEarned.toLocaleString()}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-3 gold-border text-center">
            <TrendingUp size={20} className="text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">Active</p>
            <p className="font-heading font-bold text-lg">{referrals.filter(r => r.status === 'active').length}</p>
          </motion.div>
        </div>

        {/* How it works */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card rounded-2xl p-4 gold-border">
          <h3 className="font-heading font-bold text-sm mb-3 gold-text">💡 How It Works</h3>
          <div className="space-y-2">
            {[
              'Share your unique refer code with friends',
              'Friend signs up using your code',
              `When your friend makes an approved deposit, you earn ${referralPercent}% bonus`,
              referralMinDeposit > 0
                ? `Eligible on deposits from ৳${referralMinDeposit.toLocaleString()} and above`
                : 'Any approved deposit can qualify',
              `Earn up to ৳${referralCap.toLocaleString()} per referral!`,
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full gold-gradient flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Referral List */}
        <div>
          <h3 className="font-heading font-bold text-sm mb-2">📋 Referral History</h3>
          {loading ? (
            <div className="bg-card rounded-xl p-6 gold-border text-center">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="bg-card rounded-xl p-6 gold-border text-center">
              <Users size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No referrals yet. Share your code to start earning!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card rounded-xl p-3 gold-border flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                    <Users size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm truncate">{r.referred_username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-sm text-success">৳{Number(r.bonus_earned).toLocaleString()}</p>
                    <span className={`text-[10px] font-heading px-1.5 py-0.5 rounded-full ${
                      r.status === 'active' ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {r.status === 'active' ? 'Active' : 'Pending'}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
