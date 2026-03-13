import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { Users, TrendingUp, ArrowUpRight, Wallet } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const COLORS = ['hsl(43,96%,56%)', 'hsl(142,76%,46%)', 'hsl(210,80%,60%)', 'hsl(0,84%,60%)', 'hsl(270,60%,60%)', 'hsl(30,90%,55%)'];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(216,65%,18%)',
  border: '1px solid hsl(43,96%,56%,0.3)',
  borderRadius: 8,
  fontSize: 12,
};

const AdminAnalytics = () => {
  const [userGrowth, setUserGrowth] = useState<{ label: string; users: number; cumulative: number }[]>([]);
  const [depositTrends, setDepositTrends] = useState<{ label: string; deposits: number; count: number }[]>([]);
  const [dauData, setDauData] = useState<{ label: string; dau: number }[]>([]);
  const [methodData, setMethodData] = useState<{ name: string; value: number }[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalUsers: 0, newUsersToday: 0, newUsersWeek: 0,
    totalDeposits: 0, avgDeposit: 0, depositCountToday: 0,
  });
  const [depositPeriod, setDepositPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const fetchUserGrowth = useCallback(async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (!profiles || profiles.length === 0) return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    // Summary
    const newToday = profiles.filter(p => new Date(p.created_at) >= todayStart).length;
    const newWeek = profiles.filter(p => new Date(p.created_at) >= weekStart).length;

    setSummaryStats(prev => ({
      ...prev,
      totalUsers: profiles.length,
      newUsersToday: newToday,
      newUsersWeek: newWeek,
    }));

    // Group by day (last 30 days)
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dayMap: Record<string, number> = {};
    for (let d = new Date(thirtyDaysAgo); d <= todayStart; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(5, 10); // MM-DD
      dayMap[key] = 0;
    }

    profiles.forEach(p => {
      const d = new Date(p.created_at);
      if (d >= thirtyDaysAgo) {
        const key = d.toISOString().slice(5, 10);
        if (dayMap[key] !== undefined) dayMap[key]++;
      }
    });

    let cumulative = profiles.filter(p => new Date(p.created_at) < thirtyDaysAgo).length;
    const growthData = Object.entries(dayMap).map(([label, count]) => {
      cumulative += count;
      return { label, users: count, cumulative };
    });

    setUserGrowth(growthData);
  }, []);

  const fetchDepositTrends = useCallback(async () => {
    const now = new Date();
    let rangeStart: Date;
    if (depositPeriod === 'daily') {
      rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate() - 30);
    } else if (depositPeriod === 'weekly') {
      rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate() - 84);
    } else {
      rangeStart = new Date(now); rangeStart.setMonth(rangeStart.getMonth() - 12);
    }

    const { data: deposits } = await supabase
      .from('deposits')
      .select('amount, created_at, method')
      .eq('status', 'approved')
      .gte('created_at', rangeStart.toISOString())
      .order('created_at', { ascending: true });

    if (!deposits) return;

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayDeposits = deposits.filter(d => new Date(d.created_at) >= todayStart);

    setSummaryStats(prev => ({
      ...prev,
      totalDeposits: deposits.reduce((s, d) => s + Number(d.amount), 0),
      avgDeposit: deposits.length > 0 ? Math.round(deposits.reduce((s, d) => s + Number(d.amount), 0) / deposits.length) : 0,
      depositCountToday: todayDeposits.length,
    }));

    // Group deposits by period
    const bucketMap: Record<string, { deposits: number; count: number }> = {};
    deposits.forEach(d => {
      const dt = new Date(d.created_at);
      let key: string;
      if (depositPeriod === 'daily') key = dt.toISOString().slice(5, 10);
      else if (depositPeriod === 'weekly') key = 'W' + dt.toISOString().slice(5, 10);
      else key = dt.toISOString().slice(0, 7);

      if (!bucketMap[key]) bucketMap[key] = { deposits: 0, count: 0 };
      bucketMap[key].deposits += Number(d.amount);
      bucketMap[key].count++;
    });

    setDepositTrends(Object.entries(bucketMap).map(([label, v]) => ({ label, ...v })));

    // Deposit method pie
    const methodMap: Record<string, number> = {};
    deposits.forEach(d => {
      methodMap[d.method] = (methodMap[d.method] || 0) + Number(d.amount);
    });
    setMethodData(Object.entries(methodMap).map(([name, value]) => ({ name, value })));
  }, [depositPeriod]);

  const fetchDAU = useCallback(async () => {
    // DAU from game_sessions - unique users per day over last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions } = await supabase
      .from('game_sessions')
      .select('user_id, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!sessions) return;

    const dayUsers: Record<string, Set<string>> = {};
    sessions.forEach(s => {
      const key = new Date(s.created_at).toISOString().slice(5, 10);
      if (!dayUsers[key]) dayUsers[key] = new Set();
      dayUsers[key].add(s.user_id);
    });

    // Fill missing days
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let d = new Date(thirtyDaysAgo); d <= todayStart; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(5, 10);
      if (!dayUsers[key]) dayUsers[key] = new Set();
    }

    const sorted = Object.entries(dayUsers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, users]) => ({ label, dau: users.size }));

    setDauData(sorted);
  }, []);

  useEffect(() => {
    fetchUserGrowth();
    fetchDAU();
  }, [fetchUserGrowth, fetchDAU]);

  useEffect(() => {
    fetchDepositTrends();
  }, [fetchDepositTrends]);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5">
      <h1 className="font-heading font-bold text-lg md:text-2xl">📈 Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        {[
          { icon: Users, label: 'Total Users', value: summaryStats.totalUsers, color: 'text-blue-400' },
          { icon: ArrowUpRight, label: 'New Today', value: `+${summaryStats.newUsersToday}`, color: 'text-green-400' },
          { icon: ArrowUpRight, label: 'New This Week', value: `+${summaryStats.newUsersWeek}`, color: 'text-cyan-400' },
          { icon: Wallet, label: 'Deposits (range)', value: `৳${summaryStats.totalDeposits.toLocaleString()}`, color: 'text-primary' },
          { icon: TrendingUp, label: 'Avg Deposit', value: `৳${summaryStats.avgDeposit.toLocaleString()}`, color: 'text-amber-400' },
          { icon: Wallet, label: 'Deposits Today', value: summaryStats.depositCountToday, color: 'text-emerald-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card rounded-xl p-2.5 md:p-3 gold-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={14} className={color} />
              <span className="text-[9px] md:text-[10px] text-muted-foreground">{label}</span>
            </div>
            <p className="font-heading font-bold text-sm md:text-lg">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* User Growth Chart */}
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <h3 className="font-heading font-bold text-sm md:text-base mb-3">👥 User Growth (30 days)</h3>
          {userGrowth.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={userGrowth}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210,80%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210,80%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,40%,25%)" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="cumulative" stroke="hsl(210,80%,60%)" fill="url(#userGrad)" strokeWidth={2} name="Total Users" />
                <Area type="monotone" dataKey="users" stroke="hsl(142,76%,46%)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" name="New Users" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-xs text-center py-12">No user data yet</p>
          )}
        </div>

        {/* Daily Active Users */}
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <h3 className="font-heading font-bold text-sm md:text-base mb-3">🔥 Daily Active Users (30 days)</h3>
          {dauData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dauData}>
                <defs>
                  <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(43,96%,56%)" />
                    <stop offset="100%" stopColor="hsl(43,96%,36%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,40%,25%)" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="dau" fill="url(#dauGrad)" name="Active Users" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-xs text-center py-12">No activity data yet</p>
          )}
        </div>

        {/* Deposit Trends */}
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold text-sm md:text-base">💰 Deposit Trends</h3>
            <Tabs value={depositPeriod} onValueChange={(v) => setDepositPeriod(v as any)}>
              <TabsList className="h-7 md:h-8 bg-background/60">
                <TabsTrigger value="daily" className="text-[10px] md:text-xs px-2 py-1">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="text-[10px] md:text-xs px-2 py-1">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-[10px] md:text-xs px-2 py-1">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {depositTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={depositTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,40%,25%)" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(216,20%,60%)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => [
                    name === 'deposits' ? `৳${value.toLocaleString()}` : value,
                    name === 'deposits' ? 'Amount' : 'Count',
                  ]}
                />
                <Line type="monotone" dataKey="deposits" stroke="hsl(142,76%,46%)" strokeWidth={2} dot={{ r: 3 }} name="deposits" />
                <Line type="monotone" dataKey="count" stroke="hsl(43,96%,56%)" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} name="count" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-xs text-center py-12">No deposit data yet</p>
          )}
        </div>

        {/* Deposit Methods Pie */}
        <div className="bg-card rounded-xl p-3 md:p-4 gold-border">
          <h3 className="font-heading font-bold text-sm md:text-base mb-3">📊 Deposit Methods</h3>
          {methodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={methodData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {methodData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [`৳${value.toLocaleString()}`, 'Amount']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-xs text-center py-12">No deposit data yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
