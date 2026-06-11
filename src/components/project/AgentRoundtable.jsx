import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import AgentBadge, { AGENTS } from '@/components/chat/AgentBadge';
import ReactMarkdown from 'react-markdown';

const AGENT_SEQUENCE = [
  'solution_architect',
  'db_architect',
  'backend_architect',
  'ui_ux_architect',
  'qa_architect',
];

const AGENT_NAMES = {
  business_analyst: 'Alex (BA)',
  product_manager: 'Morgan (PM)',
  solution_architect: 'Jordan (SA)',
  db_architect: 'Riley (DBA)',
  ui_ux_architect: 'Casey (UI/UX)',
  backend_architect: 'Taylor (Backend)',
  qa_architect: 'Sam (QA)',
};

// What each agent focuses on in roundtable discussions
const AGENT_ROUNDTABLE_ROLE = {
  solution_architect: `You are "Jordan" (Solution Architect). Discuss system architecture decisions — modules, tech stack, scalability, integration points. Reference the data model, requirements, and what other agents said. Be opinionated and specific.`,
  db_architect: `You are "Riley" (Database Architect). Discuss data modeling decisions — entity design, relationships, indexing strategy, normalization choices. Directly reference the current data entities and suggest improvements or flag issues.`,
  backend_architect: `You are "Taylor" (Backend Architect). Discuss API design, workflows, business logic, and automation. Reference the data model for endpoint design and flag any backend concerns raised by other agents.`,
  ui_ux_architect: `You are "Casey" (UI/UX Architect). Discuss user interface structure, page flows, and usability. Reference the data entities to ensure every entity has appropriate pages. Flag UX implications of architectural decisions.`,
  qa_architect: `You are "Sam" (QA Architect). Review what other agents discussed — identify inconsistencies, gaps, risks, and unresolved conflicts between architecture, data model, and UI decisions. Be constructive.`,
};

const DISCUSSION_TOPICS = [
  'Review the current data model and architecture — raise any concerns, conflicts, or improvements.',
  'Discuss the API design strategy based on the data entities defined so far.',
  'Review UI/UX decisions in the context of the data model and backend architecture.',
  'Identify the top 3 architectural risks and propose mitigations.',
  'Discuss authentication, authorization, and security architecture.',
  'Review scalability and performance considerations for the data model.',
];

async function getProjectContext(project) {
  const [reqs, entities, pages, workflows, apis, convos] = await Promise.all([
    base44.entities.Requirement.filter({ project_id: project.id }),
    base44.entities.DataEntity.filter({ project_id: project.id }),
    base44.entities.PageSpec.filter({ project_id: project.id }),
    base44.entities.WorkflowSpec.filter({ project_id: project.id }),
    base44.entities.ApiEndpoint.filter({ project_id: project.id }),
    base44.entities.Conversation.filter({ project_id: project.id }),
  ]);

  let ctx = `PROJECT: "${project.name}" | Type: ${project.type?.replace(/_/g, ' ')} | Industry: ${project.industry || 'Not specified'}\n\n`;

  if (reqs.length > 0) {
    ctx += `REQUIREMENTS (${reqs.length}):\n`;
    reqs.slice(0, 15).forEach(r => { ctx += `• [${r.category}] ${r.title}: ${r.description?.slice(0, 100) || ''}\n`; });
    ctx += '\n';
  }

  if (entities.length > 0) {
    ctx += `DATA ENTITIES (${entities.length}):\n`;
    entities.slice(0, 15).forEach(e => {
      const fields = (e.fields || []).map(f => `${f.name}:${f.type}${f.required ? '*' : ''}`).join(', ');
      ctx += `• ${e.name} [${e.module || 'General'}] — ${fields.slice(0, 200)}\n`;
      if (e.relationships?.length > 0) {
        ctx += `  → ${e.relationships.map(r => `${(r.type || '').replace(/_/g,' ')} ${r.related_entity}`).join(', ')}\n`;
      }
    });
    ctx += '\n';
  }

  if (pages.length > 0) {
    ctx += `UI PAGES (${pages.length}):\n`;
    pages.slice(0, 10).forEach(p => { ctx += `• ${p.name} [${p.type}] ${p.route || ''}\n`; });
    ctx += '\n';
  }

  if (apis.length > 0) {
    ctx += `API ENDPOINTS (${apis.length}):\n`;
    apis.slice(0, 10).forEach(a => { ctx += `• ${a.method} ${a.path}: ${a.description?.slice(0, 80) || ''}\n`; });
    ctx += '\n';
  }

  // Include last few messages from main chat
  const mainConvo = convos.find(c => c.section === 'discovery');
  if (mainConvo?.messages?.length > 0) {
    const recent = mainConvo.messages.slice(-6).map(m =>
      `${m.role === 'user' ? 'User' : AGENT_NAMES[m.agent_type] || 'AI'}: ${m.content?.slice(0, 300)}`
    ).join('\n');
    ctx += `RECENT MAIN CHAT:\n${recent}\n`;
  }

  return ctx;
}

export default function AgentRoundtable({ project }) {
  const [discussion, setDiscussion] = useState([]); // [{agent_type, content, timestamp}]
  const [running, setRunning] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [topic, setTopic] = useState(DISCUSSION_TOPICS[0]);
  const [customTopic, setCustomTopic] = useState('');
  const endRef = useRef(null);
  const stopRef = useRef(false);
  const { toast } = useToast();

  // Load persisted roundtable from DB
  useEffect(() => {
    loadRoundtable();
  }, [project.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussion, currentAgent]);

  const loadRoundtable = async () => {
    const convos = await base44.entities.Conversation.filter(
      { project_id: project.id, section: 'architecture' }, '-created_date', 1
    );
    if (convos.length > 0) {
      setDiscussion(convos[0].messages || []);
    }
  };

  const saveRoundtable = async (messages) => {
    const convos = await base44.entities.Conversation.filter(
      { project_id: project.id, section: 'architecture' }, '-created_date', 1
    );
    if (convos.length > 0) {
      await base44.entities.Conversation.update(convos[0].id, { messages });
    } else {
      await base44.entities.Conversation.create({
        project_id: project.id,
        section: 'architecture',
        agent_type: 'solution_architect',
        title: 'Agent Roundtable',
        messages,
        status: 'active',
      });
    }
  };

  const startDiscussion = async () => {
    stopRef.current = false;
    setRunning(true);
    let projectCtx = '';
    try {
      projectCtx = await getProjectContext(project);
    } catch (e) {
      console.error('Failed to load project context:', e);
    }
    const activeTopic = customTopic.trim() || topic;

    let currentMessages = [...discussion];

    // Add topic header message
    const topicMsg = {
      id: Date.now().toString(),
      role: 'system',
      agent_type: 'system',
      content: `📋 **Discussion Topic:** ${activeTopic}`,
      timestamp: new Date().toISOString(),
    };
    currentMessages = [...currentMessages, topicMsg];
    setDiscussion([...currentMessages]);

    // Each agent speaks once in sequence
    for (let i = 0; i < AGENT_SEQUENCE.length; i++) {
      if (stopRef.current) break;

      const agentType = AGENT_SEQUENCE[i];
      setCurrentAgent(agentType);

      // Build what agents before this one said in THIS round
      const priorInRound = currentMessages
        .filter(m => m.role === 'assistant')
        .slice(-8)
        .map(m => `${AGENT_NAMES[m.agent_type] || m.agent_type}: ${m.content?.slice(0, 400)}`)
        .join('\n\n');

      const prompt = `${AGENT_ROUNDTABLE_ROLE[agentType]}

PROJECT CONTEXT:
${projectCtx}

DISCUSSION TOPIC: "${activeTopic}"

WHAT OTHER AGENTS SAID SO FAR IN THIS DISCUSSION:
${priorInRound || '(You are the first to speak on this topic)'}

Now give YOUR perspective on this topic as ${AGENT_NAMES[agentType]}. Be specific, reference actual project details, and directly respond to points raised by other agents. Keep it to 3-5 key points. Use markdown.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'claude_sonnet_4_6',
      });

      if (stopRef.current) break;

      const msg = {
        id: (Date.now() + i).toString(),
        role: 'assistant',
        agent_type: agentType,
        content: response,
        timestamp: new Date().toISOString(),
      };
      currentMessages = [...currentMessages, msg];
      setDiscussion([...currentMessages]);
    }

    try {
      await saveRoundtable(currentMessages);
    } catch (e) {
      console.error('Failed to save roundtable:', e);
    }
    setCurrentAgent(null);
    setRunning(false);

    if (!stopRef.current) {
      toast({ title: 'Roundtable complete', description: 'All agents have shared their perspectives.', duration: 3000 });
    }
  };

  const stopDiscussion = () => {
    stopRef.current = true;
    setRunning(false);
    setCurrentAgent(null);
  };

  const clearDiscussion = async () => {
    setDiscussion([]);
    const convos = await base44.entities.Conversation.filter(
      { project_id: project.id, section: 'architecture' }, '-created_date', 1
    );
    if (convos.length > 0) {
      await base44.entities.Conversation.update(convos[0].id, { messages: [] });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Zap className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground">Agent Roundtable</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">— agents discuss automatically</span>
        </div>

        {/* Agent avatars */}
        <div className="hidden sm:flex items-center gap-0.5">
          {AGENT_SEQUENCE.map(a => (
            <div key={a} className={`transition-all ${currentAgent === a ? 'scale-125' : 'opacity-50'}`}>
              <AgentBadge agentType={a} size="sm" showLabel={false} />
            </div>
          ))}
        </div>

        <button
          onClick={clearDiscussion}
          disabled={running}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40 p-1"
          title="Clear discussion"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Topic selector */}
      <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex-shrink-0 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {DISCUSSION_TOPICS.map((t, i) => (
            <button
              key={i}
              onClick={() => { setTopic(t); setCustomTopic(''); }}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                topic === t && !customTopic
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              {t.slice(0, 40)}{t.length > 40 ? '…' : ''}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            placeholder="Or type a custom discussion topic..."
            className="flex-1 text-xs bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {!running ? (
            <Button size="sm" className="h-7 text-xs gap-1.5 flex-shrink-0" onClick={startDiscussion}>
              <Play className="w-3 h-3" /> Start Discussion
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5 flex-shrink-0" onClick={stopDiscussion}>
              <Square className="w-3 h-3" /> Stop
            </Button>
          )}
        </div>
      </div>

      {/* Discussion messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {discussion.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No discussions yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">Pick a topic above and click "Start Discussion" — all agents will automatically discuss the topic based on your project's current state.</p>
          </div>
        )}

        {discussion.map((msg, i) => {
          if (msg.agent_type === 'system') {
            return (
              <div key={msg.id || i} className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium px-2 whitespace-nowrap">
                  {msg.content?.replace(/[*#]/g, '')}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }

          const agentConfig = AGENTS[msg.agent_type];
          const Icon = agentConfig?.icon;

          return (
            <div key={msg.id || i} className="flex gap-3 animate-fade-in">
              <div className="flex-shrink-0 mt-1">
                <AgentBadge agentType={msg.agent_type} size="sm" showLabel={false} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-foreground">{AGENT_NAMES[msg.agent_type] || msg.agent_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator for current speaking agent */}
        {currentAgent && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex-shrink-0 mt-1">
              <AgentBadge agentType={currentAgent} size="sm" showLabel={false} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-foreground">{AGENT_NAMES[currentAgent]}</span>
                <span className="text-xs text-primary animate-pulse">thinking...</span>
              </div>
              <div className="bg-card border border-border rounded-xl px-3 py-2.5">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}