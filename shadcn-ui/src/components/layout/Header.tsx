import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, LogOut, Settings, Terminal, Command, Sparkles } from 'lucide-react';
import { SynteroMark } from './SynteroMark';

export function Header() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams<{ listId?: string; reqId?: string }>();
    const [listName, setListName] = useState<string>('');
    const [requirementTitle, setRequirementTitle] = useState<string>('');

    // Load list and requirement data for breadcrumb
    useEffect(() => {
        const loadBreadcrumbData = async () => {
            if (params.listId && user) {
                const { data: list } = await supabase
                    .from('lists')
                    .select('name')
                    .eq('id', params.listId)
                    .eq('user_id', user.id)
                    .single();

                if (list) setListName(list.name);
            }

            if (params.reqId && user) {
                const { data: req } = await supabase
                    .from('requirements')
                    .select('title')
                    .eq('id', params.reqId)
                    .single();

                if (req) setRequirementTitle(req.title);
            }
        };

        loadBreadcrumbData();
    }, [params.listId, params.reqId, user]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const getUserInitials = () => {
        if (!user?.email) return 'U';
        return user.email.substring(0, 2).toUpperCase();
    };

    const isActive = (path: string | string[]) => {
        const paths = Array.isArray(path) ? path : [path];
        return paths.some((p) => {
            if (p === '/') {
                return location.pathname === '/';
            }
            return location.pathname.startsWith(p);
        });
    };

    // Tech Minimal Breadcrumb
    const getBreadcrumb = () => {
        const pathParts = location.pathname.split('/').filter(Boolean);

        if (pathParts[0] === 'dashboard' && params.listId) {
            return (
                <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500">
                    <span className="text-slate-300">/</span>
                    <Link to="/dashboard" className="hover:text-blue-600 transition-colors">
                        dashboard
                    </Link>

                    {params.listId && (
                        <>
                            <span className="text-slate-300">/</span>
                            <Link
                                to={`/dashboard/${params.listId}/requirements`}
                                className="hover:text-blue-600 transition-colors max-w-[100px] truncate"
                            >
                                {listName || 'project'}
                            </Link>
                        </>
                    )}

                    {params.reqId && (
                        <>
                            <span className="text-slate-300">/</span>
                            <span className="text-slate-900 font-medium max-w-[150px] truncate">
                                {requirementTitle || 'requirement'}
                            </span>
                        </>
                    )}
                </div>
            );
        }
        return null;
    };

    const breadcrumb = getBreadcrumb();

    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
            {/* Animated Gradient Line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent w-[200%] animate-[shimmer_3s_infinite_linear] -translate-x-full" />
            </div>

            <div className="container mx-auto px-6 h-14 flex items-center justify-between gap-4">
                {/* Logo & Brand */}
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
                        <SynteroMark compact />
                        {/* Minimal Subtitle - Hidden on mobile */}
                        <span className="hidden lg:inline-block text-[10px] font-mono text-slate-400 tracking-wider uppercase border-l border-slate-200 pl-3 ml-1">
                            AI Workspace
                        </span>
                    </Link>

                    {/* Tech Minimal Breadcrumb */}
                    {breadcrumb}
                </div>

                {/* Navigation */}
                <nav className="flex items-center gap-1 flex-shrink-0">
                    {user ? (
                        <>
                            <Link to="/dashboard">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-9 px-3 text-sm font-medium hover:bg-slate-100/50 transition-all ${isActive('/dashboard') ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                >
                                    <Terminal className="h-3.5 w-3.5 mr-2" />
                                    Dashboard
                                </Button>
                            </Link>

                            <Link to="/configuration">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-9 px-3 text-sm font-medium hover:bg-slate-100/50 transition-all ${isActive(['/configuration']) ? 'text-slate-900 bg-slate-100/50' : 'text-slate-600'}`}
                                >
                                    <Settings className="h-3.5 w-3.5 mr-2" />
                                    Config
                                </Button>
                            </Link>

                            <Link to="/how-it-works">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-9 px-3 text-sm font-medium hover:bg-slate-100/50 transition-all ${isActive('/how-it-works') ? 'text-slate-900' : 'text-slate-600'}`}
                                >
                                    <Command className="h-3.5 w-3.5 mr-2" />
                                    Docs
                                </Button>
                            </Link>

                            <div className="w-px h-4 bg-slate-200 mx-2" />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="relative h-8 w-8 rounded-lg hover:bg-slate-100 p-0 ring-1 ring-slate-200/50"
                                    >
                                        <Avatar className="h-8 w-8 rounded-lg">
                                            <AvatarFallback className="bg-slate-50 text-slate-600 font-mono text-xs rounded-lg">
                                                {getUserInitials()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {/* Status Indicator */}
                                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 bg-white/95 backdrop-blur-xl border-slate-200 shadow-xl rounded-xl p-1"
                                    sideOffset={8}
                                >
                                    <DropdownMenuLabel className="px-2 py-1.5">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium text-slate-900">Account</p>
                                            <p className="text-xs text-slate-500 font-mono truncate">
                                                {user.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    <DropdownMenuItem
                                        onClick={() => navigate('/profile')}
                                        className="rounded-lg cursor-pointer text-xs font-medium"
                                    >
                                        <User className="mr-2 h-3.5 w-3.5" />
                                        <span>Profile</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    <DropdownMenuItem
                                        onClick={handleSignOut}
                                        className="rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 text-xs font-medium"
                                    >
                                        <LogOut className="mr-2 h-3.5 w-3.5" />
                                        <span>Sign out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <>
                            <Link to="/login">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                                >
                                    Log in
                                </Button>
                            </Link>
                            <Link to="/register">
                                <Button
                                    size="sm"
                                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm h-8 px-4 text-xs font-medium rounded-lg"
                                >
                                    <Sparkles className="w-3 h-3 mr-2" />
                                    Get Started
                                </Button>
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header >
    );
}
