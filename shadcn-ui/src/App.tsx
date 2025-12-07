import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import RootPage from './pages/RootPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import Requirements from './pages/requirements/Requirements';
import RequirementDetail from './pages/requirements/RequirementDetail';
import NotFound from './pages/NotFound';
import Configuration from './pages/configuration/Configuration';
import ConfigurationActivities from './pages/configuration/ConfigurationActivities';
import ConfigurationPresets from './pages/configuration/ConfigurationPresets';
import HowItWorks from './pages/HowItWorks';
import Profile from './pages/configuration/Profile';
import { OrganizationSettings } from './pages/configuration/OrganizationSettings';
import AiWizardTestPage from './pages/test/AiWizardTestPage';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard/:listId/requirements"
            element={
              <AuthGuard>
                <Requirements />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard/:listId/requirements/:reqId"
            element={
              <AuthGuard>
                <RequirementDetail />
              </AuthGuard>
            }
          />
          <Route
            path="/configuration"
            element={
              <AuthGuard>
                <Configuration />
              </AuthGuard>
            }
          />
          <Route
            path="/configuration/activities"
            element={
              <AuthGuard>
                <ConfigurationActivities />
              </AuthGuard>
            }
          />

          <Route
            path="/configuration/presets"
            element={
              <AuthGuard>
                <ConfigurationPresets />
              </AuthGuard>
            }
          />
          <Route
            path="/profile"
            element={
              <AuthGuard>
                <Profile />
              </AuthGuard>
            }
          />
          <Route
            path="/organization"
            element={
              <AuthGuard>
                <OrganizationSettings />
              </AuthGuard>
            }
          />
          {/* Test Routes (Development Only) */}
          <Route
            path="/test/ai-wizard"
            element={
              <AuthGuard>
                <AiWizardTestPage />
              </AuthGuard>
            }
          />
          {/* Backward compatibility redirects */}
          <Route path="/lists" element={<Navigate to="/dashboard" replace />} />
          <Route path="/lists/:listId/requirements" element={<Navigate to="/dashboard/:listId/requirements" replace />} />
          <Route path="/lists/:listId/requirements/:reqId" element={<Navigate to="/dashboard/:listId/requirements/:reqId" replace />} />
          <Route path="/admin" element={<Navigate to="/configuration" replace />} />
          <Route path="/admin/activities" element={<Navigate to="/configuration/activities" replace />} />
          <Route path="/presets" element={<Navigate to="/configuration/presets" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
