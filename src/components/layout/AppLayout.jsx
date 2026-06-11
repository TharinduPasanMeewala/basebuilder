import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, FolderOpen, Plus, ChevronLeft, ChevronRight,
  Settings, LogOut, Sparkles, Menu, X, User, Building2
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
  const [collapsed, setCollapsed] = useState(false);
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-sidebar-border ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-white text-sm font-bold tracking-tight">ArchitectAI</p>
            <p className="text-sidebar-foreground text-xs opacity-60">Blueprint Platform</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((navItem) => (
          <Link
            key={navItem.path}
            to={navItem.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
              isActive(navItem.path)
                ? 'bg-primary text-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <navItem.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="font-medium">{navItem.label}</span>}
          </Link>
        ))}

        {!collapsed && (
          <div className="pt-4">
            <Button
              onClick={() => { navigate('/projects/new'); setMobileOpen(false); }}
              className="w-full text-xs h-8 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
              variant="ghost"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              New Project
            </Button>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={`border-t border-sidebar-border p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`flex items-center gap-2.5 w-full hover:bg-sidebar-hover rounded-md p-2 transition-colors ${collapsed ? 'justify-center' : ''}`}>
              <Avatar className="w-7 h-7 flex-shrink-0">
                <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">U</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="text-left min-w-0">
                  <p className="text-white text-xs font-medium truncate">My Account</p>
                  <p className="text-sidebar-foreground text-xs opacity-60 truncate">Admin</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col sidebar-bg border-r border-sidebar-border transition-all duration-200 flex-shrink-0 ${collapsed ? 'w-16' : 'w-56'}`}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-full w-5 h-10 sidebar-bg border border-sidebar-border rounded-r-md flex items-center justify-center text-sidebar-foreground hover:text-white transition-colors z-10"
          style={{ marginLeft: collapsed ? '4rem' : '14rem' }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 sidebar-bg border-r border-sidebar-border">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">ArchitectAI</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}