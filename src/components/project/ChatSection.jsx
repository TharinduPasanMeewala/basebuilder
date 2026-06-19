import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, FileText, Users, ChevronDown, Image, Link, X, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';
import AgentBadge, { AGENTS } from '@/components/chat/AgentBadge';

const AGENT_SEQUENCE = [
  'business_analyst',
  'product_manager',
  'solution_architect',
  'db_architect',
  'ui_ux_architect',
  'backend_architect',
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

const VALID_CATEGORIES = ['functional', 'non_functional', 'business_rule', 'user_story', 'constraint', 'assumption'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_PAGE_TYPES = ['dashboard', 'list', 'detail', 'form', 'report', 'settings', 'auth', 'landing', 'kanban', 'calendar', 'chart'];
const VALID_FIELD_TYPES = ['string', 'text', 'number', 'integer', 'boolean', 'date', 'datetime', 'json', 'array', 'email', 'url', 'enum'];

// Build a rich cross-agent context so every agent knows what others have said/decided
async function buildCrossAgentContext(project) {
  const [convos, reqs, entities, pages, workflows, apis] = await Promise.all([
    base44.entities.Conversation.filter({ project_id: project.id }),
    base44.entities.Requirement.filter({ project_id: project.id }),
    base44.entities.DataEntity.filter({ project_id: project.id }),
    base44.entities.PageSpec.filter({ project_id: project.id }),
    base44.entities.WorkflowSpec.filter({ project_id: project.id }),
    base44.entities.ApiEndpoint.filter({ project_id: project.id }),
  ]);

  // Summarize what each agent has contributed so far
  const agentOutputs = {};
  convos.forEach(c => {
    const agentMsgs = (c.messages || [])
      .filter(m => m.role === 'assistant')
      .slice(-3)
      .map(m => m.content?.slice(0, 500))
      .join('\n');
    if (agentMsgs && c.agent_type) {
      agentOutputs[c.agent_type] = agentMsgs;
    }
  });

  let ctx = `\n\n=== SHARED PROJECT KNOWLEDGE (from all agents) ===\n`;
  ctx += `Project: "${project.name}" | Type: ${project.type?.replace(/_/g, ' ')} | Industry: ${project.industry || 'Not specified'}\n`;

  if (reqs.length > 0) {
    ctx += `\n--- Requirements (${reqs.length} captured by BA/PM) ---\n`;
    reqs.slice(0, 20).forEach(r => {
      ctx += `• [${r.category}] ${r.title}: ${r.description?.slice(0, 120) || ''}\n`;
    });
  }

  if (entities.length > 0) {
    ctx += `\n--- Data Entities (${entities.length} designed by DB Architect) ---\n`;
    entities.slice(0, 15).forEach(e => {
      const fields = (e.fields || []).map(f => `${f.name}:${f.type}`).join(', ');
      ctx += `• ${e.name} [${e.module || 'General'}]: ${fields.slice(0, 150)}\n`;
      if (e.relationships?.length > 0) {
        ctx += `  Relations: ${e.relationships.map(r => `${r.type} → ${r.related_entity}`).join(', ')}\n`;
      }
    });
  }

  if (pages.length > 0) {
    ctx += `\n--- UI Pages (${pages.length} designed by UI/UX Architect) ---\n`;
    pages.slice(0, 12).forEach(p => {
      ctx += `• ${p.name} [${p.type}] - ${p.route || ''}: ${p.description?.slice(0, 100) || ''}\n`;
    });
  }

  if (workflows.length > 0) {
    ctx += `\n--- Workflows (${workflows.length} defined by Backend Architect) ---\n`;
    workflows.slice(0, 8).forEach(w => {
      ctx += `• ${w.name}: ${w.description?.slice(0, 100) || ''}\n`;
    });
  }

  if (apis.length > 0) {
    ctx += `\n--- API Endpoints (${apis.length} defined) ---\n`;
    apis.slice(0, 10).forEach(a => {
      ctx += `• ${a.method} ${a.path}: ${a.description?.slice(0, 80) || ''}\n`;
    });
  }

  // Add what other agents have said
  Object.entries(agentOutputs).forEach(([agent, output]) => {
    if (output) {
      ctx += `\n--- ${AGENT_NAMES[agent] || agent} recent analysis ---\n${output}\n`;
    }
  });

  ctx += `\n=== END SHARED KNOWLEDGE ===\n`;
  return ctx;
}

function buildSystemPrompt(project, agentType, crossAgentContext) {
  const basePrompt = {
    business_analyst: `You are "Alex", a senior Business Analyst in a team of AI architects collaborating to design a ${project.type?.replace(/_/g, ' ')} called "${project.name}".

Your role: Discover and refine business requirements through conversation. Ask ONE focused question at a time. Build on what other agents have already identified. After 8-10 exchanges, summarize findings and suggest the PM agent (Morgan) can now analyze them.

IMPORTANT: Reference other agents' work when relevant (e.g., "Riley's data model shows X, which aligns with your requirement for Y").`,

    product_manager: `You are "Morgan", a senior Product Manager in a team of AI architects collaborating to design a ${project.type?.replace(/_/g, ' ')} called "${project.name}".

Your role: Analyze requirements gathered by Alex (BA) and produce structured PRD content — personas, user stories, prioritized features. Reference the data model from Riley (DBA) and pages from Casey (UI/UX) when available. Format output clearly with markdown.`,

    solution_architect: `You are "Jordan", a senior Solution Architect in a team of AI architects collaborating to design a ${project.type?.replace(/_/g, ' ')} called "${project.name}".

Your role: Define the system architecture — modules, tech stack, integrations, scalability. Build on Alex's requirements, Morgan's PRD, and Riley's data model. Reference what other agents have designed and add architectural reasoning.`,

    db_architect: `You are "Riley", a senior Database Architect in a team of AI architects collaborating to design a ${project.type?.replace(/_/g, ' ')} called "${project.name}".

Your role: Design the complete data model. Use the requirements from Alex (BA), feature list from Morgan (PM), and architecture from Jordan (SA) to create comprehensive database entities with fields, types, constraints, relationships and indexes.

When generating a schema, output structured JSON code blocks AND plain-English explanations for each entity. Reference business requirements explicitly (e.g., "This entity supports the requirement: user tracking").

Always be specific about field types: string, text, number, integer, boolean, date, datetime, json, array, email, url, enum.`,

    ui_ux_architect: `You are "Casey", a senior UI/UX Architect in a team of AI architects collaborating to design a ${project.type?.replace(/_/g, ' ')} called "${project.name}".

Your role: Design the complete UI structure — pages, navigation, user flows, forms. Reference Riley's data model to ensure every entity has appropriate CRUD pages. Reference Morgan's user personas to tailor UX decisions.`,

    backend_architect: `You are "Taylor", a senior Backend Architect in a team of AI architects collaborating to design a ${project.type?.replace(/_/g, ' ')} called "${project.name}".

Your role: Design APIs, workflows, automation rules, and backend logic. Reference Riley's data model for endpoint design, Casey's pages for API consumption patterns, and Jordan's architecture for infrastructure decisions.`,

    qa_architect: `You are "Sam", a senior QA Architect in a team of AI architects collaborating to design a ${project.type?.replace(/_/g, ' ')} called "${project.name}".

Your role: Review the ENTIRE specification across all agents — find gaps, inconsistencies, and missing elements. Score completeness (0-100%) and give actionable feedback. Be constructive and specific, referencing what each agent produced.`,
  };

  const prompt = basePrompt[agentType] || basePrompt.business_analyst;
  return prompt + (crossAgentContext || '');
}

async function extractRequirementsInBackground(project, userMsg, assistantMsg) {
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Requirements extraction engine. Extract concrete software requirements from this exchange.
PROJECT: "${project.name}" (${project.type?.replace(/_/g, ' ')})
USER: ${userMsg}
AI RESPONSE: ${assistantMsg}
Return only CONCRETE, ACTIONABLE requirements. Empty array if none.`,
      response_json_schema: {
        type: 'object',
        properties: {
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                priority: { type: 'string' },
                module: { type: 'string' },
                acceptance_criteria: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const reqs = result?.requirements || [];
    if (reqs.length === 0) return 0;

    const existing = await base44.entities.Requirement.filter({ project_id: project.id });
    const existingTitles = new Set(existing.map(r => r.title?.toLowerCase().trim()));
    const newReqs = reqs.filter(r => r.title && !existingTitles.has(r.title.toLowerCase().trim()));
    if (newReqs.length === 0) return 0;

    for (let i = 0; i < newReqs.length; i++) {
      const r = newReqs[i];
      await base44.entities.Requirement.create({
        project_id: project.id,
        title: r.title,
        description: r.description || '',
        category: VALID_CATEGORIES.includes(r.category) ? r.category : 'functional',
        priority: VALID_PRIORITIES.includes(r.priority) ? r.priority : 'medium',
        module: r.module || '',
        acceptance_criteria: r.acceptance_criteria || '',
        status: 'draft',
        source: 'ai_generated',
        order_index: existing.length + i,
      });
    }
    return newReqs.length;
  } catch (e) {
    console.warn('Background requirement extraction failed:', e);
    return 0;
  }
}

async function extractVisualSpecsInBackground(project, userMsg, assistantMsg, fileUrls) {
  if (!fileUrls?.length) return { entities: 0, pages: 0 };
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Visual product analysis engine. Analyze the attached screenshot, wireframe, sketch, or UI reference and convert it into Sara Builder AI project specs.
PROJECT: "${project.name}" (${project.type?.replace(/_/g, ' ')})
USER REQUEST: ${userMsg}
AGENT RESPONSE: ${assistantMsg}

Extract only what is visible or strongly implied by the image:
1. Data entities needed to power the UI, with fields and relationships.
2. UI pages/screens represented by the image.

Return practical specs that can be saved directly. Avoid duplicates and generic filler.`,
      file_urls: fileUrls,
      response_json_schema: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                module: { type: 'string' },
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      type: { type: 'string' },
                      required: { type: 'boolean' },
                      description: { type: 'string' },
                      enum_values: { type: 'array', items: { type: 'string' } },
                      foreign_key: { type: 'string' },
                    },
                  },
                },
                relationships: { type: 'array', items: { type: 'object' } },
              },
            },
          },
          pages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                route: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
                module: { type: 'string' },
                components: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    });

    const [existingEntities, existingPages] = await Promise.all([
      base44.entities.DataEntity.filter({ project_id: project.id }),
      base44.entities.PageSpec.filter({ project_id: project.id }),
    ]);
    const entityNames = new Set(existingEntities.map(e => e.name?.toLowerCase().trim()));
    const pageNames = new Set(existingPages.map(p => p.name?.toLowerCase().trim()));
    const newEntities = (result?.entities || []).filter(e => e.name && !entityNames.has(e.name.toLowerCase().trim())).slice(0, 12);
    const newPages = (result?.pages || []).filter(p => p.name && !pageNames.has(p.name.toLowerCase().trim())).slice(0, 12);

    for (let i = 0; i < newEntities.length; i++) {
      const entity = newEntities[i];
      await base44.entities.DataEntity.create({
        project_id: project.id,
        name: entity.name,
        description: entity.description || '',
        module: entity.module || 'Visual Import',
        fields: (entity.fields || []).map(field => ({
          name: field.name,
          type: VALID_FIELD_TYPES.includes(field.type) ? field.type : 'string',
          required: !!field.required,
          description: field.description || '',
          enum_values: field.enum_values || [],
          foreign_key: field.foreign_key || '',
        })).filter(field => field.name),
        relationships: Array.isArray(entity.relationships) ? entity.relationships : [],
        source: 'ai_generated',
        order_index: existingEntities.length + i,
      });
    }

    for (let i = 0; i < newPages.length; i++) {
      const page = newPages[i];
      await base44.entities.PageSpec.create({
        project_id: project.id,
        name: page.name,
        route: page.route || `/${page.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        type: VALID_PAGE_TYPES.includes(page.type) ? page.type : 'list',
        description: page.description || '',
        module: page.module || 'Visual Import',
        components: Array.isArray(page.components) ? page.components : [],
        source: 'ai_generated',
        order_index: existingPages.length + i,
      });
    }

    if (newEntities.length > 0 || newPages.length > 0) {
      await base44.entities.Project.update(project.id, { phase: 'design', completeness_score: Math.max(project.completeness_score || 0, 50) });
    }

    return { entities: newEntities.length, pages: newPages.length };
  } catch (e) {
    console.warn('Background visual spec extraction failed:', e);
    return { entities: 0, pages: 0 };
  }
}

export default function ChatSection({ project, onRefresh }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [activeAgent, setActiveAgent] = useState('business_analyst');
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [attachments, setAttachments] = useState([]); // [{type:'image'|'url', url, name}]
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);
  const { toast } = useToast();

  useEffect(() => { loadOrCreateConversation(); }, [project.id]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const loadOrCreateConversation = async () => {
    setLoading(true);
    const convos = await base44.entities.Conversation.filter(
      { project_id: project.id, section: 'discovery' }, '-created_date', 1
    );
    if (convos.length > 0) {
      setConversation(convos[0]);
      setMessages(convos[0].messages || []);
      if (convos[0].agent_type) setActiveAgent(convos[0].agent_type);
    } else {
      const convo = await base44.entities.Conversation.create({
        project_id: project.id,
        section: 'discovery',
        agent_type: 'business_analyst',
        title: 'Multi-Agent Design Session',
        messages: [],
        status: 'active',
      });
      setConversation(convo);
      setMessages([]);
      await sendInitialGreeting(convo);
    }
    setLoading(false);
  };

  const sendInitialGreeting = async (convo) => {
    setSending(true);
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are "Alex", a senior Business Analyst. Introduce yourself briefly and start requirements discovery for "${project.name}" (a ${project.type?.replace(/_/g, ' ')}${project.description ? ` — ${project.description}` : ''}). Mention that a full team of specialist agents (PM, Solution Architect, DB Architect, UI/UX, Backend, QA) will collaborate on this project. Ask the first discovery question.`,
      model: 'claude_sonnet_4_6',
    });

    const msg = {
      id: Date.now().toString(),
      role: 'assistant',
      agent_type: 'business_analyst',
      content: response,
      timestamp: new Date().toISOString(),
    };
    await base44.entities.Conversation.update(convo.id, { messages: [msg] });
    setMessages([msg]);
    setSending(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAttachments(a => [...a, { type: 'image', url: file_url, name: file.name }]);
    setUploading(false);
    e.target.value = '';
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setAttachments(a => [...a, { type: 'url', url: trimmed, name: trimmed }]);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const removeAttachment = (idx) => setAttachments(a => a.filter((_, i) => i !== idx));

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || sending || !conversation) return;

    const fileUrls = attachments.map(a => a.url);
    const attachmentDesc = attachments.length > 0
      ? `\n[Attachments: ${attachments.map(a => `${a.type === 'image' ? '🖼 Image' : '🔗 URL'}: ${a.name}`).join(', ')}]`
      : '';

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: (input.trim() || 'Please analyze the attached content.') + attachmentDesc,
      file_urls: fileUrls.length > 0 ? fileUrls : undefined,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setAttachments([]);
    setSending(true);

    // Fetch full cross-agent context (what all other agents know)
    const crossAgentContext = await buildCrossAgentContext(projectRef.current);
    const systemPrompt = buildSystemPrompt(projectRef.current, activeAgent, crossAgentContext);

    // Recent conversation history (last 12 messages)
    const history = updatedMessages
      .slice(-12)
      .map(m => `${m.role === 'user' ? 'User' : AGENT_NAMES[m.agent_type] || 'AI'}: ${m.content}`)
      .join('\n\n');

    const prompt = `${systemPrompt}

CURRENT CONVERSATION:
${history}

Respond as ${AGENT_NAMES[activeAgent]}. Be professional, specific, and reference the shared project knowledge when relevant. Use markdown for structured content.${fileUrls.length > 0 ? '\n\nThe user has shared visual/URL content — analyze it carefully. If it is a screenshot, wireframe, or sketch, identify the UI screens, forms, tables, data fields, entities, relationships, and user workflows it implies.' : ''}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
      file_urls: fileUrls.length > 0 ? fileUrls : undefined,
    });

    const assistantMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      agent_type: activeAgent,
      content: response,
      timestamp: new Date().toISOString(),
    };

    const finalMessages = [...updatedMessages, assistantMsg];
    await base44.entities.Conversation.update(conversation.id, {
      messages: finalMessages,
      agent_type: activeAgent,
    });
    setMessages(finalMessages);
    setSending(false);

    // Background extraction: requirements plus UI/data specs from uploaded visuals
    setExtracting(true);
    Promise.all([
      extractRequirementsInBackground(projectRef.current, userMsg.content, response),
      extractVisualSpecsInBackground(projectRef.current, userMsg.content, response, fileUrls),
    ])
      .then(([reqCount, visual]) => {
        if (reqCount > 0 || visual.entities > 0 || visual.pages > 0) {
          toast({
            title: 'AI specs captured',
            description: `${reqCount} requirement${reqCount === 1 ? '' : 's'}, ${visual.entities} data model${visual.entities === 1 ? '' : 's'}, ${visual.pages} UI page${visual.pages === 1 ? '' : 's'} created.`,
            duration: 4000,
          });
          onRefresh?.();
        }
      })
      .finally(() => setExtracting(false));
  };

  // Ask another agent to chime in on the last message
  const askAgentToDiscuss = async (agentType) => {
    if (sending || messages.length === 0) return;
    setShowAgentMenu(false);

    const lastFewMessages = messages.slice(-6).map(m =>
      `${m.role === 'user' ? 'User' : AGENT_NAMES[m.agent_type] || 'AI'}: ${m.content}`
    ).join('\n\n');

    setSending(true);
    const crossAgentContext = await buildCrossAgentContext(projectRef.current);
    const systemPrompt = buildSystemPrompt(projectRef.current, agentType, crossAgentContext);

    const prompt = `${systemPrompt}

RECENT CONVERSATION (between user and other agents):
${lastFewMessages}

As ${AGENT_NAMES[agentType]}, add your perspective on the discussion above. Reference your domain expertise and what the other agents have said. Keep it focused and valuable (3-6 sentences or a short structured list). You may agree, extend, or respectfully challenge points made by other agents.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    const agentMsg = {
      id: Date.now().toString(),
      role: 'assistant',
      agent_type: agentType,
      content: response,
      timestamp: new Date().toISOString(),
    };

    const finalMessages = [...messages, agentMsg];
    await base44.entities.Conversation.update(conversation.id, { messages: finalMessages });
    setMessages(finalMessages);
    setActiveAgent(agentType);
    setSending(false);
  };

  const switchAgent = async (agentType) => {
    setActiveAgent(agentType);
    if (conversation) {
      await base44.entities.Conversation.update(conversation.id, { agent_type: agentType });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Agent selector bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card/50 overflow-x-auto flex-shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">Reply as:</span>
        {AGENT_SEQUENCE.map(agentType => (
          <button
            key={agentType}
            onClick={() => switchAgent(agentType)}
            title={AGENTS[agentType]?.label}
            className={`flex-shrink-0 transition-all rounded-full ${
              activeAgent === agentType
                ? 'ring-2 ring-primary ring-offset-1 opacity-100'
                : 'opacity-40 hover:opacity-70'
            }`}
          >
            <AgentBadge agentType={agentType} size="sm" showLabel={false} />
          </button>
        ))}

        <div className="ml-auto flex-shrink-0 flex items-center gap-2">
          {extracting && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">capturing...</span>
            </span>
          )}

          {/* "Ask agent to discuss" button */}
          <div className="relative">
            <button
              onClick={() => setShowAgentMenu(v => !v)}
              disabled={sending || messages.length === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 border border-border rounded-md px-2 py-1 transition-colors"
              title="Ask another agent to weigh in"
            >
              <Users className="w-3 h-3" />
              <span>Ask agent</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showAgentMenu && (
              <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[180px]">
                <p className="text-xs text-muted-foreground px-2 pb-1.5 border-b border-border mb-1">Ask to weigh in:</p>
                {AGENT_SEQUENCE.filter(a => a !== activeAgent).map(agentType => (
                  <button
                    key={agentType}
                    onClick={() => askAgentToDiscuss(agentType)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-xs text-left transition-colors"
                  >
                    <AgentBadge agentType={agentType} size="sm" showLabel={false} />
                    <span>{AGENT_NAMES[agentType]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <AgentBadge agentType={activeAgent} size="sm" showLabel={true} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0" onClick={() => setShowAgentMenu(false)}>
        {messages.length === 0 && !sending && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Starting multi-agent session...</p>
            </div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {sending && <TypingIndicator agentType={activeAgent} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-card flex-shrink-0">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs max-w-[200px]">
                {a.type === 'image' ? <Image className="w-3 h-3 text-primary flex-shrink-0" /> : <Link className="w-3 h-3 text-primary flex-shrink-0" />}
                <span className="truncate text-foreground">{a.name}</span>
                <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* URL input row */}
        {showUrlInput && (
          <div className="flex gap-1.5 mb-2">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
              placeholder="Paste a URL (website, Figma, GitHub, etc.)"
              className="flex-1 text-xs bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs" onClick={addUrl} disabled={!urlInput.trim()}>Add</Button>
            <button onClick={() => setShowUrlInput(false)} className="text-muted-foreground hover:text-foreground p-1"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          {/* Attach buttons */}
          <div className="flex gap-1 flex-shrink-0">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              className="h-9 w-9 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              title="Attach image"
            >
              {uploading ? <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" /> : <Image className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setShowUrlInput(v => !v)}
              disabled={sending}
              className={`h-9 w-9 flex items-center justify-center rounded-md border border-border transition-colors disabled:opacity-40 ${showUrlInput ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title="Add URL"
            >
              <Link className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${AGENTS[activeAgent]?.label || 'AI'}... (Enter to send)`}
              className="resize-none min-h-[44px] max-h-32 text-sm py-3"
              rows={1}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={(!input.trim() && attachments.length === 0) || sending}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
          📎 Attach images or URLs · Select agent above · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}