import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, RefreshCw, Info } from 'lucide-react';

interface AgentNumber {
  id: string;
  payment_method: string;
  number: string;
  rotation_hours: number;
  sort_order: number;
  is_active: boolean;
}

const AgentNumbersPage = () => {
  const { user } = useAuth();
  const [numbers, setNumbers] = useState<AgentNumber[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNumbers = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('agent_payment_numbers')
      .select('id, payment_method, number, rotation_hours, sort_order, is_active')
      .eq('agent_id', user.id)
      .order('payment_method')
      .order('sort_order');
    setNumbers((data || []) as AgentNumber[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchNumbers();
  }, [user]);

  if (loading) return <div className="p-3 md:p-6 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-bold text-2xl">📱 My Payment Numbers</h1>
        <button onClick={fetchNumbers} className="p-2 rounded-lg bg-card gold-border">
          <RefreshCw size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="bg-primary/10 rounded-xl p-4 gold-border flex items-start gap-3">
        <Info size={18} className="text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-heading font-bold text-primary mb-1">Admin sets these numbers</p>
          <p>Your payment numbers are added and configured by Admin in <strong>Admin Dashboard → Payment Agents</strong>. Rotation hours and order are set there. Contact admin to add or change numbers.</p>
        </div>
      </div>

      {numbers.length === 0 ? (
        <div className="bg-card rounded-xl p-8 gold-border text-center">
          <Phone size={40} className="text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="font-heading font-bold text-muted-foreground">No numbers assigned</p>
          <p className="text-xs text-muted-foreground mt-1">Contact admin to add your bKash/Nagad numbers for deposit rotation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {numbers.map((n) => (
            <div key={n.id} className="bg-card rounded-xl p-4 gold-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-primary font-heading font-bold">{n.payment_method}</span>
                  <span className="font-heading font-bold text-lg">{n.number}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  n.is_active ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'
                }`}>
                  {n.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>Rotation: {n.rotation_hours} hour{n.rotation_hours !== 1 ? 's' : ''}</span>
                <span>Order: {n.sort_order}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentNumbersPage;
