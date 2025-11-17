import { Toaster } from '@/components/ui/sonner';
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;