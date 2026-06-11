import React from 'react';
import { 
  UserSearch, ClipboardList, Layers, Database, 
  Monitor, Server, ShieldCheck 
} from 'lucide-react';

const AGENTS = {
  business_analyst: {
    label: 'Business Analyst',
    shortLabel: 'BA',
    icon: UserSearch,
    colorClass: 'agent-ba',
    bgClass: 'agent-ba-bg',
    description: 'Gathers requirements and business goals'
  },
  product_manager: {
    label: 'Product Manager',
    shortLabel: 'PM',
    icon: ClipboardList,
    colorClass: 'agent-pm',
    bgClass: 'agent-pm-bg',
    description: 'Defines specs, user stories, and acceptance criteria'
  },
  solution_architect: {
    label: 'Solution Architect',
    shortLabel: 'SA',
    icon: Layers,
    colorClass: 'agent-sa',
    bgClass: 'agent-sa-bg',
    description: 'Designs system architecture and modules'
  },
  db_architect: {
    label: 'Database Architect',
    shortLabel: 'DB',
    icon: Database,
    colorClass: 'agent-db',
    bgClass: 'agent-db-bg',
    description: 'Designs entities, schemas, and relationships'
  },
  ui_ux_architect: {
    label: 'UI/UX Architect',
    shortLabel: 'UI',
    icon: Monitor,
    colorClass: 'agent-ui',
    bgClass: 'agent-ui-bg',
    description: 'Specifies pages, navigation, and user flows'
  },
  backend_architect: {
    label: 'Backend Architect',
    shortLabel: 'BE',
    icon: Server,
    colorClass: 'agent-be',
    bgClass: 'agent-be-bg',
    description: 'Designs APIs, workflows, and automations'
  },
  qa_architect: {
    label: 'QA Architect',
    shortLabel: 'QA',
    icon: ShieldCheck,
    colorClass: 'agent-qa',
    bgClass: 'agent-qa-bg',
    description: 'Validates completeness and identifies gaps'
  }
};

export function getAgent(type) {
  return AGENTS[type] || AGENTS.business_analyst;
}

export default function AgentBadge({ agentType, size = 'sm', showLabel = true }) {
  const agent = getAgent(agentType);
  const Icon = agent.icon;

  if (size === 'icon') {
    return (
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 ${agent.bgClass}`}>
        <Icon className={`w-3.5 h-3.5 ${agent.colorClass}`} />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${agent.bgClass} ${agent.colorClass}`}>
      <Icon className="w-3 h-3" />
      {showLabel && <span>{agent.label}</span>}
    </div>
  );
}

export { AGENTS };