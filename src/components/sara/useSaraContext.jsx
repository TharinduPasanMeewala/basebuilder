import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export function useSaraContext() {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState(localStorage.getItem('sara_workspace_id') || '');
  const [selectedProjectId, setSelectedProjectIdState] = useState(localStorage.getItem('sara_project_id') || '');

  const load = async () => {
    setLoading(true);
    const me = await base44.auth.me();
    const [ws, ps] = await Promise.all([
      base44.entities.Workspace.list('-created_date', 100),
      base44.entities.Project.list('-created_date', 100),
    ]);
    setUser(me); setWorkspaces(ws); setProjects(ps);
    if (!selectedWorkspaceId && ws[0]) setSelectedWorkspaceId(ws[0].id);
    if (!selectedProjectId && ps[0]) setSelectedProjectId(ps[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setSelectedWorkspaceId = (id) => {
    localStorage.setItem('sara_workspace_id', id);
    setSelectedWorkspaceIdState(id);
    const project = projects.find(p => p.workspace_id === id);
    setSelectedProjectId(project?.id || '');
  };
  const setSelectedProjectId = (id) => {
    localStorage.setItem('sara_project_id', id);
    setSelectedProjectIdState(id);
  };
  const createWorkspace = async (data) => {
    const created = await base44.entities.Workspace.create({ ...data, created_by: user?.email });
    setSelectedWorkspaceId(created.id); await load(); return created;
  };
  const createProject = async (data) => {
    const workspace_id = data.workspace_id || selectedWorkspaceId;
    const created = await base44.entities.Project.create({ ...data, workspace_id, created_by: user?.email });
    setSelectedProjectId(created.id); await load(); return created;
  };

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0];
  const scopedProjects = projects.filter(p => p.workspace_id === selectedWorkspace?.id);
  const selectedProject = scopedProjects.find(p => p.id === selectedProjectId) || scopedProjects[0];

  return { user, workspaces, projects, scopedProjects, selectedWorkspace, selectedProject, selectedWorkspaceId, selectedProjectId, loading, load, createWorkspace, createProject, setSelectedWorkspaceId, setSelectedProjectId };
}