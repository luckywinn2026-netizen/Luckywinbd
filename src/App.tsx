import { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, Navigate } from "react-router-dom";

// Build-time variant: 'user' | 'admin' | 'agent' – controls which UI the APK shows
const APP_VARIANT = (import.meta.env.VITE_APP_VARIANT as 'user' | 'admin' | 'agent') || 'user';
import { WalletProvider } from '@/contexts/WalletContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastPreferencesProvider } from '@/contexts/ToastPreferencesContext';
import SplashScreen from '@/components/SplashScreen';
import AuthModal from '@/components/AuthModal';
import Layout from '@/components/Layout';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import MaintenanceBannerWrapper from '@/components/MaintenanceBannerWrapper';
import AndroidBackButtonHandler from '@/components/AndroidBackButtonHandler';
import AppUpdateChecker from '@/components/AppUpdateChecker';
import PermissionRequest from '@/components/PermissionRequest';

// Core pages — Index lazy-loaded to avoid HMR/cache export issues
const Index = lazy(() => import("./pages/Index"));

// Lazy-loaded pages
const LivePage = lazy(() => import("./pages/LivePage"));
const SlotsPage = lazy(() => import("./pages/SlotsPage"));
const CrashPage = lazy(() => import("./pages/CrashPage"));
const SlotGamePage = lazy(() => import("./pages/SlotGamePage"));
const CrashGamePage = lazy(() => import("./pages/CrashGamePage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const PaymentMethodChoicePage = lazy(() => import("./pages/PaymentMethodChoicePage"));
const DepositPage = lazy(() => import("./pages/DepositPage"));
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"));
const DepositAgentPage = lazy(() => import("./pages/DepositAgentPage"));
const WithdrawAgentPage = lazy(() => import("./pages/WithdrawAgentPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const BetHistoryPage = lazy(() => import("./pages/BetHistoryPage"));
const PromotionsPage = lazy(() => import("./pages/PromotionsPage"));
const VipPage = lazy(() => import("./pages/VipPage"));
const SpinWheelPage = lazy(() => import("./pages/SpinWheelPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const SupportChat = lazy(() => import("./components/SupportChat"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const SportsPage = lazy(() => import("./pages/SportsPage"));
const InstallPage = lazy(() => import("./pages/InstallPage"));

// Admin pages — heavy, lazy-loaded
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminDeposits = lazy(() => import("./pages/admin/AdminDeposits"));
const AdminWithdrawals = lazy(() => import("./pages/admin/AdminWithdrawals"));
const AdminWallets = lazy(() => import("./pages/admin/AdminWallets"));
const AdminGames = lazy(() => import("./pages/admin/AdminGames"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminCrashSettings = lazy(() => import("./pages/admin/AdminCrashSettings"));
const AdminLiveMonitor = lazy(() => import("./pages/admin/AdminLiveMonitor"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals"));
const AdminBonusRules = lazy(() => import("./pages/admin/AdminBonusRules"));
const AdminPromoBanners = lazy(() => import("./pages/admin/AdminPromoBanners"));
const AdminGameAssets = lazy(() => import("./pages/admin/AdminGameAssets"));
const AdminMultiplierSettings = lazy(() => import("./pages/admin/AdminMultiplierSettings"));
const AdminProfitSettings = lazy(() => import("./pages/admin/AdminProfitSettings"));
const AdminChatManagement = lazy(() => import("./pages/admin/AdminChatManagement"));
const AdminSubAdmins = lazy(() => import("./pages/admin/AdminSubAdmins"));
const AgentDashboard = lazy(() => import("./pages/agent/AgentDashboard"));


const AdminAgents = lazy(() => import("./pages/admin/AdminAgents"));
const AdminAgentPerformance = lazy(() => import("./pages/admin/AdminAgentPerformance"));
const AgentOverview = lazy(() => import("./pages/admin/AgentOverview"));
const AgentNumbersPage = lazy(() => import("./pages/admin/AgentNumbersPage"));
const AgentDepositsPage = lazy(() => import("./pages/admin/AgentDepositsPage"));
const AgentWithdrawalsPage = lazy(() => import("./pages/admin/AgentWithdrawalsPage"));
const AgentSettlementsPage = lazy(() => import("./pages/admin/AgentSettlementsPage"));
const AdminCyberMatches = lazy(() => import("./pages/admin/AdminCyberMatches"));
const AdminAgentApplications = lazy(() => import("./pages/admin/AdminAgentApplications"));
const AdminFakeWins = lazy(() => import("./pages/admin/AdminFakeWins"));
const BecomeAgentPage = lazy(() => import("./pages/BecomeAgentPage"));
const AgentLoginPage = lazy(() => import("./pages/agent/AgentLoginPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — avoid refetching unchanged data
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      refetchOnWindowFocus: false, // Don't refetch when user switches tabs
      retry: 1, // Only 1 retry instead of 3
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const SlotGameRoute = () => {
  const { gameId } = useParams();
  return (
    <Suspense fallback={<PageLoader />}>
      <SlotGamePage gameId={gameId || 'lucky-777'} />
    </Suspense>
  );
};

const CrashGameRoute = () => {
  const { gameId } = useParams();
  return (
    <Suspense fallback={<PageLoader />}>
      <CrashGamePage gameId={gameId || 'aviator'} />
    </Suspense>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WalletProvider>
            <LanguageProvider>
            <ToastPreferencesProvider>
            <Sonner position="top-center" richColors />
            <SplashScreen show={showSplash} />
            <AuthModal />
            <BrowserRouter>
              <AndroidBackButtonHandler />
              <MaintenanceBannerWrapper>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Admin APK: only admin interface, redirect / to /admin */}
                  {APP_VARIANT === 'admin' && (
                    <>
                      <Route path="/" element={<Navigate to="/admin" replace />} />
                      <Route path="/admin" element={<AdminLogin />} />
                      <Route path="/admin/*" element={<AdminLayout />}>
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="referrals" element={<AdminReferrals />} />
                        <Route path="bonus-rules" element={<AdminBonusRules />} />
                        <Route path="deposits" element={<AdminDeposits />} />
                        <Route path="withdrawals" element={<AdminWithdrawals />} />
                        <Route path="wallets" element={<AdminWallets />} />
                        <Route path="games" element={<AdminGames />} />
                        <Route path="game-assets" element={<AdminGameAssets />} />
                        <Route path="promo-banners" element={<AdminPromoBanners />} />
                        <Route path="analytics" element={<AdminAnalytics />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="crash-control" element={<AdminCrashSettings />} />
                        <Route path="multiplier" element={<AdminMultiplierSettings />} />
                        <Route path="profit-settings" element={<AdminProfitSettings />} />
                        <Route path="chat-management" element={<AdminChatManagement />} />
                        <Route path="sub-admins" element={<AdminSubAdmins />} />
                        <Route path="live-monitor" element={<AdminLiveMonitor />} />
                        <Route path="cyber-matches" element={<AdminCyberMatches />} />
                        <Route path="agents" element={<AdminAgents />} />
                        <Route path="agent-performance" element={<AdminAgentPerformance />} />
                        <Route path="agent-overview" element={<AgentOverview />} />
                        <Route path="agent-numbers" element={<AgentNumbersPage />} />
                        <Route path="agent-deposits" element={<AgentDepositsPage />} />
                        <Route path="agent-withdrawals" element={<AgentWithdrawalsPage />} />
                        <Route path="agent-settlements" element={<AgentSettlementsPage />} />
                        <Route path="agent-applications" element={<AdminAgentApplications />} />
                        <Route path="fake-wins" element={<AdminFakeWins />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/admin" replace />} />
                    </>
                  )}
                  {/* Agent APK: only agent interface, redirect / to /agent-login */}
                  {APP_VARIANT === 'agent' && (
                    <>
                      <Route path="/" element={<Navigate to="/agent-login" replace />} />
                      <Route path="/agent-login" element={<AgentLoginPage />} />
                      <Route path="/admin" element={<AdminLogin />} />
                      <Route path="/admin/*" element={<AdminLayout />}>
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="referrals" element={<AdminReferrals />} />
                        <Route path="bonus-rules" element={<AdminBonusRules />} />
                        <Route path="deposits" element={<AdminDeposits />} />
                        <Route path="withdrawals" element={<AdminWithdrawals />} />
                        <Route path="wallets" element={<AdminWallets />} />
                        <Route path="games" element={<AdminGames />} />
                        <Route path="game-assets" element={<AdminGameAssets />} />
                        <Route path="promo-banners" element={<AdminPromoBanners />} />
                        <Route path="analytics" element={<AdminAnalytics />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="crash-control" element={<AdminCrashSettings />} />
                        <Route path="multiplier" element={<AdminMultiplierSettings />} />
                        <Route path="profit-settings" element={<AdminProfitSettings />} />
                        <Route path="chat-management" element={<AdminChatManagement />} />
                        <Route path="sub-admins" element={<AdminSubAdmins />} />
                        <Route path="live-monitor" element={<AdminLiveMonitor />} />
                        <Route path="cyber-matches" element={<AdminCyberMatches />} />
                        <Route path="agents" element={<AdminAgents />} />
                        <Route path="agent-performance" element={<AdminAgentPerformance />} />
                        <Route path="agent-overview" element={<AgentOverview />} />
                        <Route path="agent-numbers" element={<AgentNumbersPage />} />
                        <Route path="agent-deposits" element={<AgentDepositsPage />} />
                        <Route path="agent-withdrawals" element={<AgentWithdrawalsPage />} />
                        <Route path="agent-settlements" element={<AgentSettlementsPage />} />
                        <Route path="agent-applications" element={<AdminAgentApplications />} />
                        <Route path="fake-wins" element={<AdminFakeWins />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/agent-login" replace />} />
                    </>
                  )}
                  {/* User APK: full app with user interface */}
                  {APP_VARIANT === 'user' && (
                    <>
                      <Route path="/slots/:gameId" element={<SlotGameRoute />} />
                      <Route path="/crash/:gameId" element={<CrashGameRoute />} />
                      <Route path="/deposit/ewallet" element={<Layout><DepositPage /></Layout>} />
                      <Route path="/deposit/agent" element={<Layout><DepositAgentPage /></Layout>} />
                      <Route path="/deposit" element={<Layout><PaymentMethodChoicePage /></Layout>} />
                      <Route path="/withdraw/ewallet" element={<Layout><WithdrawPage /></Layout>} />
                      <Route path="/withdraw/agent" element={<Layout><WithdrawAgentPage /></Layout>} />
                      <Route path="/withdraw" element={<Layout><PaymentMethodChoicePage /></Layout>} />
                      <Route path="/history" element={<Layout><HistoryPage /></Layout>} />
                      <Route path="/bet-history" element={<Layout><BetHistoryPage /></Layout>} />
                      <Route path="/promotions" element={<Layout><PromotionsPage /></Layout>} />
                      <Route path="/referrals" element={<Layout><ReferralPage /></Layout>} />
                      <Route path="/vip" element={<Layout><VipPage /></Layout>} />
                      <Route path="/spin" element={<Layout><SpinWheelPage /></Layout>} />
                      <Route path="/leaderboard" element={<Layout><LeaderboardPage /></Layout>} />
                      <Route path="/admin" element={<AdminLogin />} />
                      <Route path="/agent" element={<AgentDashboard />} />
                      <Route path="/become-agent" element={<BecomeAgentPage />} />
                      <Route path="/agent-login" element={<AgentLoginPage />} />
                      <Route path="/admin/*" element={<AdminLayout />}>
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="referrals" element={<AdminReferrals />} />
                        <Route path="bonus-rules" element={<AdminBonusRules />} />
                        <Route path="deposits" element={<AdminDeposits />} />
                        <Route path="withdrawals" element={<AdminWithdrawals />} />
                        <Route path="wallets" element={<AdminWallets />} />
                        <Route path="games" element={<AdminGames />} />
                        <Route path="game-assets" element={<AdminGameAssets />} />
                        <Route path="promo-banners" element={<AdminPromoBanners />} />
                        <Route path="analytics" element={<AdminAnalytics />} />
                        <Route path="settings" element={<AdminSettings />} />
                        <Route path="crash-control" element={<AdminCrashSettings />} />
                        <Route path="multiplier" element={<AdminMultiplierSettings />} />
                        <Route path="profit-settings" element={<AdminProfitSettings />} />
                        <Route path="chat-management" element={<AdminChatManagement />} />
                        <Route path="sub-admins" element={<AdminSubAdmins />} />
                        <Route path="live-monitor" element={<AdminLiveMonitor />} />
                        <Route path="cyber-matches" element={<AdminCyberMatches />} />
                        <Route path="agents" element={<AdminAgents />} />
                        <Route path="agent-performance" element={<AdminAgentPerformance />} />
                        <Route path="agent-overview" element={<AgentOverview />} />
                        <Route path="agent-numbers" element={<AgentNumbersPage />} />
                        <Route path="agent-deposits" element={<AgentDepositsPage />} />
                        <Route path="agent-withdrawals" element={<AgentWithdrawalsPage />} />
                        <Route path="agent-settlements" element={<AgentSettlementsPage />} />
                        <Route path="agent-applications" element={<AdminAgentApplications />} />
                        <Route path="fake-wins" element={<AdminFakeWins />} />
                      </Route>
                      <Route path="*" element={
                        <Layout>
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/live" element={<LivePage />} />
                            <Route path="/slots" element={<SlotsPage />} />
                            <Route path="/crash" element={<CrashPage />} />
                            <Route path="/account" element={<AccountPage />} />
                            <Route path="/sports" element={<SportsPage />} />
                            <Route path="/install" element={<InstallPage />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Layout>
                      } />
                    </>
                  )}
                </Routes>
              </Suspense>
              </MaintenanceBannerWrapper>
            </BrowserRouter>
            <Suspense fallback={null}>
              <SupportChat />
            </Suspense>
            <PWAInstallBanner />
            <AppUpdateChecker />
            <PermissionRequest />
            </ToastPreferencesProvider>
            </LanguageProvider>
          </WalletProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
