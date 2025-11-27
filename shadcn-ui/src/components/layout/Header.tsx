import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
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
import { User, LogOut, Shield, List, Layers, BookOpen, Settings } from 'lucide-react';
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

    // Generate breadcrumb based on current route
    const getBreadcrumb = () => {
        const pathParts = location.pathname.split('/').filter(Boolean);

        if (pathParts[0] === 'lists' && params.listId) {
            if (pathParts[2] === 'requirements') {
                if (params.reqId) {
                    // On requirement detail page
                    return (
                        <div className="flex items-center gap-1 text-sm">
                            <Link to="/lists" className="text-slate-600 hover:text-blue-600 transition-colors">
                                My Lists
                            </Link>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                            <Link
                                to={`/lists/${params.listId}/requirements`}
                                className="text-slate-600 hover:text-blue-600 transition-colors max-w-[150px] truncate"
                            >
                                {listName || 'Project'}
                            </Link>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-900 font-medium max-w-[200px] truncate">
                                {requirementTitle || 'Requirement'}
                            </span>
                        </div>
                    );
                } else {
                    // On requirements list page
                    return (
                        <div className="flex items-center gap-1 text-sm">
                            <Link to="/lists" className="text-slate-600 hover:text-blue-600 transition-colors">
                                My Lists
                            </Link>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-900 font-medium max-w-[200px] truncate">
                                {listName || 'Project'}
                            </span>
                        </div>
                    );
                }
            }
        }
        return null;
    };

    const breadcrumb = getBreadcrumb();

    return (
        <header className="border-b border-slate-200/60 backdrop-blur-xl bg-white/90 shadow-sm sticky top-0 z-50">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-4">
                {/* Logo & Brand */}
                <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
                    <SynteroMark subtitle="AI estimation workspace" compact />
                </Link>

                {/* Breadcrumb - shown when navigating in deep routes */}
                {breadcrumb && (
                    <div className="flex-1 min-w-0 flex items-center">
                        <div className="px-4 py-2 rounded-lg bg-slate-50/80 backdrop-blur-sm border border-slate-200/50">
                            {breadcrumb}
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex items-center gap-2 flex-shrink-0">
                    {user ? (
                        <>
                            <Link to="/">
                                <Button
                                    variant="ghost"
                                    className={`hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium ${isActive('/') ? 'bg-blue-50 text-blue-700' : ''}`}
                                >
                                    Home
                                </Button>
                            </Link>

                            <Link to="/lists">
                                <Button
                                    variant="ghost"
                                    className={`hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium flex items-center gap-1 ${isActive('/lists') ? 'bg-blue-50 text-blue-700' : ''}`}
                                >
                                    <List className="h-4 w-4" />
                                    Lists
                                </Button>
                            </Link>

                            <Link to="/configuration">
                                <Button
                                    variant="ghost"
                                    className={`hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium flex items-center gap-1 ${isActive(['/configuration']) ? 'bg-slate-100 text-slate-900' : ''}`}
                                >
                                    <Settings className="h-4 w-4" />
                                    Configuration
                                </Button>
                            </Link>

                            <Link to="/how-it-works">
                                <Button
                                    variant="ghost"
                                    className={`hover:bg-slate-100 transition-colors font-medium flex items-center gap-1 ${isActive('/how-it-works') ? 'bg-slate-100 text-slate-800' : ''}`}
                                >
                                    <BookOpen className="h-4 w-4" />
                                    Come funziona
                                </Button>
                            </Link>

                            <div className="w-px h-6 bg-slate-200 mx-1" />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="relative h-9 w-9 rounded-full hover:bg-blue-50 p-0"
                                    >
                                        <Avatar className="h-9 w-9 border-2 border-blue-100">
                                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-semibold text-sm">
                                                {getUserInitials()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56 bg-white/98 backdrop-blur-xl border-slate-200 shadow-xl"
                                    sideOffset={8}
                                >
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-semibold text-slate-900">My Account</p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {user.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-slate-200" />
                                    <DropdownMenuItem
                                        onClick={() => navigate('/profile')}
                                        className="cursor-pointer hover:bg-blue-50 focus:bg-blue-50"
                                    >
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Profile</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-slate-200" />
                                    <DropdownMenuItem
                                        onClick={handleSignOut}
                                        className="cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-700"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
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
                                    className="hover:bg-slate-100 transition-colors font-medium"
                                >
                                    Login
                                </Button>
                            </Link>
                            <Link to="/register">
                                <Button
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all font-medium"
                                >
                                    Sign Up
                                </Button>
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
