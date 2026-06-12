import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Plus, Settings, LogOut, Sparkles, Menu, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FolderOpen, label: 'Projects', path: '/projects' },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Header */}
      <header className="sidebar-bg border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-4 px-4 h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <p className="text-white text-sm font-bold tracking-tight leading-tight">ArchitectAI</p>
              <p className="text-sidebar-foreground text-[10px] opacity-60 leading-tight">Blueprint Platform</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map((navItem) => (
              <Link
                key={navItem.path}
                to={navItem.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-150 ${
                  isActive(navItem.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <navItem.icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{navItem.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          {/* New Project */}
          <Button
            onClick={() => navigate('/projects/new')}
            className="hidden md:inline-flex text-xs h-8 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
            variant="ghost"
          >
            <Plus className="w-3 h-3 mr-1.5" />
            New Project
          </Button>

          {/* Account */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 hover:bg-sidebar-hover rounded-md p-1.5 transition-colors">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">U</AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0 hidden lg:block">
                  <p className="text-white text-xs font-medium truncate">My Account</p>
                  <p className="text-sidebar-foreground text-xs opacity-60 truncate">Admin</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-sidebar-foreground hover:text-white">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden px-3 pb-3 space-y-1 border-t border-sidebar-border pt-2">
            {navItems.map((navItem) => (
              <Link
                key={navItem.path}
                to={navItem.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                  isActive(navItem.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <navItem.icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{navItem.label}</span>
              </Link>
            ))}
            <Button
              onClick={() => { navigate('/projects/new'); setMobileOpen(false); }}
              className="w-full text-xs h-8 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
              variant="ghost"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              New Project
            </Button>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}