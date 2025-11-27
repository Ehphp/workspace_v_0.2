import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Home, FolderOpen, FileText, Settings, HelpCircle } from 'lucide-react';

interface SidebarProps {
    className?: string;
}

export function Sidebar({ className }: SidebarProps) {
    const location = useLocation();

    const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    const navItems = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: FolderOpen, label: 'My Lists', path: '/lists' },
    ];

    return (
        <aside className={cn('w-64 border-r border-white/20 bg-white/40 backdrop-blur-sm', className)}>
            <nav className="flex flex-col gap-1 p-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                        <Link key={item.path} to={item.path}>
                            <Button
                                variant={active ? 'default' : 'ghost'}
                                className={cn(
                                    'w-full justify-start gap-3 transition-all duration-200',
                                    active
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md hover:shadow-lg'
                                        : 'hover:bg-white/60 hover:translate-x-1'
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                <span className="font-medium">{item.label}</span>
                            </Button>
                        </Link>
                    );
                })}

                <div className="my-4 border-t border-slate-200" />

                <Link to="/help">
                    <Button variant="ghost" className="w-full justify-start gap-3 hover:bg-white/60 hover:translate-x-1 transition-all duration-200">
                        <HelpCircle className="h-5 w-5" />
                        <span className="font-medium">Help & Docs</span>
                    </Button>
                </Link>

                <Link to="/configuration">
                    <Button variant="ghost" className="w-full justify-start gap-3 hover:bg-white/60 hover:translate-x-1 transition-all duration-200">
                        <Settings className="h-5 w-5" />
                        <span className="font-medium">Configuration</span>
                    </Button>
                </Link>
            </nav>
        </aside>
    );
}
