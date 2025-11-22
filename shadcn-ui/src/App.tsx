import { Toaster } from '@/components/ui/sonner';
import { Toaster as ToastToaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import Home from './pages/Index';
import Login from './pages/Login';
import Register from './pages/Register';
import Lists from './pages/Lists';
import Requirements from './pages/Requirements';
import RequirementDetail from './pages/RequirementDetail';
import NotFound from './pages/NotFound';
import Admin from './pages/Admin';
import AdminActivities from './pages/AdminActivities';
import Presets from './pages/Presets';
import HowItWorks from './pages/HowItWorks';
import Profile from './pages/Profile';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <ToastToaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route
            path="/lists"
            element={
              <AuthGuard>
                <Lists />
              </AuthGuard>
            }
          />
          <Route
            path="/lists/:listId/requirements"
            element={
              <AuthGuard>
                <Requirements />
              </AuthGuard>
            }
          />
          <Route
            path="/lists/:listId/requirements/:reqId"
            element={
              <AuthGuard>
                <RequirementDetail />
              </AuthGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <AuthGuard>
                <Admin />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/activities"
            element={
              <AuthGuard>
                <AdminActivities />
              </AuthGuard>
            }
          />
          <Route
            path="/presets"
            element={
              <AuthGuard>
                <Presets />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
