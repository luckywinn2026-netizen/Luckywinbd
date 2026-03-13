import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { getBonusRuleNumber, useBonusRules } from '@/hooks/useBonusRules';

interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_id: string;
  bonus_earned: number;
  bonus_cap: number;
  status: string;
  created_at: string;
  referrer_name?: string;
  referred_name?: string;
  referrer_code?: string;
}

const AdminReferrals = () => {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, totalBonus: 0 });
  const { rules: referralRules } = useBonusRules({ triggerTypes: ['referral_deposit_approved'], includeDisabled: true });
  const referralRule = referralRules[0] || null;
  const referralPercent = getBonusRuleNumber(referralRule, 'percent', 50);
  const referralCap = getBonusRuleNumber(referralRule, 'referral_cap', 12500);

  useEffect(() => { fetchReferrals(); }, []);

  const fetchReferrals = async () => {
    setLoading(true);
    const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
    if (!data) { setLoading(false); return; }

    // Fetch all involved user profiles
    const userIds = [...new Set(data.flatMap(r => [r.referrer_id, r.referred_id]))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, username, refer_code').in('user_id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const enriched: ReferralRow[] = data.map(r => ({
      ...r,
      bonus_earned: Number(r.bonus_earned),
      bonus_cap: Number(r.bonus_cap),
      referrer_name: profileMap.get(r.referrer_id)?.username || 'Unknown',
      referred_name: profileMap.get(r.referred_id)?.username || 'Unknown',
      referrer_code: profileMap.get(r.referrer_id)?.refer_code || '-',
    }));

    setReferrals(enriched);
    setStats({
      total: enriched.length,
      active: enriched.filter(r => r.status === 'active').length,
      totalBonus: enriched.reduce((s, r) => s + r.bonus_earned, 0),
    });
    setLoading(false);
  };

  const filtered = referrals.filter(r =>
    (r.referrer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.referred_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.referrer_code || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-3 md:p-6 space-y-4">
      <h1 className="font-heading font-bold text-lg md:text-2xl">👥 Referral Management</h1>

      <div className="bg-card rounded-xl p-4 gold-border">
        <p className="text-xs text-muted-foreground">Active Referral Rule</p>
        <p className="font-heading font-bold text-base text-primary mt-1">
          {referralRule?.name || 'No referral rule configured'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Current payout: {referralPercent}% bonus, capped at ৳{referralCap.toLocaleString()} per referral.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-4 gold-border">
          <p className="text-xs text-muted-foreground">Total Referrals</p>
          <p className="font-heading font-bold text-2xl text-primary">{stats.total}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-xl p-4 gold-border">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="font-heading font-bold text-2xl text-success">{stats.active}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-4 gold-border">
          <p className="text-xs text-muted-foreground">Total Bonus Paid</p>
          <p className="font-heading font-bold text-2xl text-primary">৳{stats.totalBonus.toLocaleString()}</p>
        </motion.div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by username or refer code..."
          className="w-full bg-card rounded-lg pl-9 pr-3 py-2.5 min-h-[44px] text-foreground font-heading outline-none gold-border focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="bg-card rounded-xl p-8 gold-border text-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="md:hidden space-y-3">
            {filtered.map(r => (
              <div key={r.id} className="bg-card rounded-xl gold-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading font-bold text-sm">{r.referrer_name}</p>
                    <p className="text-xs text-primary">{r.referrer_code}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-heading ${
                    r.status === 'active' ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
                  }`}>{r.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Referred:</span> <span className="font-heading">{r.referred_name}</span></div>
                  <div><span className="text-muted-foreground">Bonus:</span> <span className="font-bold text-success">৳{r.bonus_earned.toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Cap:</span> ৳{r.bonus_cap.toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Date:</span> {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8">
                <Users size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No referrals found</p>
              </div>
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block bg-card rounded-xl gold-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b border-border">
                    <th className="text-left p-3">Referrer</th>
                    <th className="text-left p-3">Code</th>
                    <th className="text-left p-3">Referred User</th>
                    <th className="text-left p-3">Bonus Earned</th>
                    <th className="text-left p-3">Cap</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-secondary/50 transition-colors">
                      <td className="p-3 font-heading font-bold">{r.referrer_name}</td>
                      <td className="p-3 text-primary font-heading tracking-wider text-xs">{r.referrer_code}</td>
                      <td className="p-3 font-heading">{r.referred_name}</td>
                      <td className="p-3 font-heading font-bold text-success">৳{r.bonus_earned.toLocaleString()}</td>
                      <td className="p-3 text-muted-foreground">৳{r.bonus_cap.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-heading ${
                          r.status === 'active' ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
                        }`}>{r.status}</span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <Users size={32} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No referrals found</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReferrals;
