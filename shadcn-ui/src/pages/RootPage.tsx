import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import Home from './Home';

/**
 * RootPage component that conditionally renders the Home page or redirects to Dashboard
 * based on user authentication status.
 * 
 * - Authenticated users: Redirected to /dashboard
 * - Non-authenticated users: Home landing page shown
 */
export default function RootPage() {
    const { user, loading } = useAuth();

    // Show nothing while checking auth status (prevents flash of wrong content)
    if (loading) {
        return null;
    }

    // Redirect authenticated users to dashboard
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    // Show public home page for non-authenticated users
    return <Home />;
}
