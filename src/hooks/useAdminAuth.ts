import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import * as api from '@/lib/api';

export type AdminRole = 'admin' | 'moderator' | 'payment_agent' | null;

export const useAdminAuth = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole>(null);
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setAdminRole(null);
      setAllowedRoutes([]);
      setLoading(false);
      return;
    }

    const checkRole = async () => {
      try {
        const isAdm = await api.rpc<boolean>('has_role', { _user_id: user.id, _role: 'admin' });
        if (isAdm) {
          setIsAdmin(true);
          setAdminRole('admin');
          setAllowedRoutes([]);
          setLoading(false);
          return;
        }
        const isMod = await api.rpc<boolean>('has_role', { _user_id: user.id, _role: 'moderator' });
        if (isMod) {
          const { data: perms } = await supabase
            .from('sub_admin_permissions')
            .select('module')
            .eq('user_id', user.id);
          const routes = (perms || []).map(p => p.module);
          setIsAdmin(true);
          setAdminRole('moderator');
          setAllowedRoutes(routes);
          setLoading(false);
          return;
        }
        const isAgent = await api.rpc<boolean>('has_role', { _user_id: user.id, _role: 'payment_agent' });
        if (isAgent) {
          setIsAdmin(true);
          setAdminRole('payment_agent');
          setAllowedRoutes([
            '/admin/agent-overview',
            '/admin/agent-numbers',
            '/admin/agent-deposits',
            '/admin/agent-withdrawals',
          ]);
          setLoading(false);
          return;
        }
      } catch (_) {}
      setIsAdmin(false);
      setAdminRole(null);
      setAllowedRoutes([]);
      setLoading(false);
    };
    checkRole();
  }, [user, authLoading]);

  return { isAdmin, adminRole, allowedRoutes, loading, user };
};
