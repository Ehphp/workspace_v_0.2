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
import EstimationAccuracy from './pages/analytics/EstimationAccuracy';
import PromptManagement from './pages/admin/PromptManagement';
import ProjectActivitiesPage from './pages/activities/ProjectActivitiesPage';
import PipelineDebug from './pages/dev/PipelineDebug';

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
            path="/dashboard/:projectId/requirements"
            element={
              <AuthGuard>
                <Requirements />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard/:projectId/requirements/:reqId"
            element={
              <AuthGuard>
                <RequirementDetail />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard/:projectId/activities"
            element={
              <AuthGuard>
                <ProjectActivitiesPage />
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
            path="/configuration/technologies"
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
          <Route
            path="/analytics/accuracy"
            element={
              <AuthGuard>
                <EstimationAccuracy />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/prompts"
            element={
              <AuthGuard>
                <PromptManagement />
              </AuthGuard>
            }
          />
          {/* Legacy route compatibility — can be removed after deprecation window */}
          <Route path="/lists" element={<Navigate to="/dashboard" replace />} />
          <Route path="/lists/:listId/requirements" element={<Navigate to="/dashboard" replace />} />
          <Route path="/lists/:listId/requirements/:reqId" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard/:projectId/requirements/*" element={<Navigate to="/dashboard/:projectId/requirements" replace />} />
          <Route path="/admin" element={<Navigate to="/configuration" replace />} />
          <Route path="/admin/activities" element={<Navigate to="/configuration/activities" replace />} />
          <Route path="/presets" element={<Navigate to="/configuration/technologies" replace />} />
          <Route path="/configuration/presets" element={<Navigate to="/configuration/technologies" replace />} />
          <Route path="/dev/pipeline-debug" element={<PipelineDebug />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
