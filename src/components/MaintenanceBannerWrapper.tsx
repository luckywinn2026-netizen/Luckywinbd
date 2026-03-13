import { useLocation } from 'react-router-dom';
import { useMaintenance } from '@/hooks/useMaintenance';
import MaintenanceBanner from './MaintenanceBanner';

export default function MaintenanceBannerWrapper({ children }: { children: React.ReactNode }) {
  const { appUnderMaintenance, message } = useMaintenance();
  const { pathname } = useLocation();
  const isAdminOrAgentPath = pathname.startsWith('/admin') || pathname.startsWith('/agent') || pathname.startsWith('/agent-login');
  if (appUnderMaintenance && !isAdminOrAgentPath) {
    return <MaintenanceBanner message={message} fullScreen />;
  }
  return <>{children}</>;
}
