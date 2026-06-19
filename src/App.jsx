import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Dashboard from '@/pages/dashboard';
import Workspaces from '@/pages/workspaces';
import Projects from '@/pages/projects';
import EntityBuilder from '@/pages/entity-builder';
import FunctionStudio from '@/pages/function-studio';
import AgentLab from '@/pages/agent-lab';
import Preview from '@/pages/preview';
import Exports from '@/pages/exports';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  if (isLoadingPublicSettings || isLoadingAuth) return <div className="fixed inset-0 flex items-center justify-center bg-background"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /><p className="text-sm text-muted-foreground">Loading Sara Builder AI...</p></div></div>;
  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }
  return <Routes><Route path="/" element={<Dashboard />} /><Route path="/workspaces" element={<Workspaces />} /><Route path="/projects" element={<Projects />} /><Route path="/entity-builder" element={<EntityBuilder />} /><Route path="/function-studio" element={<FunctionStudio />} /><Route path="/agent-lab" element={<AgentLab />} /><Route path="/preview" element={<Preview />} /><Route path="/exports" element={<Exports />} /><Route path="*" element={<PageNotFound />} /></Routes>;
};

function App() {
  return <AuthProvider><QueryClientProvider client={queryClientInstance}><Router><AuthenticatedApp /></Router><Toaster /></QueryClientProvider></AuthProvider>;
}

export default App;