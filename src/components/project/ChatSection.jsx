import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
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

const PHASE_AGENT_MAP = {
  discovery: 'business_analyst',
  analysis: 'product_manager',
  design: 'ui_ux_architect',
  architecture: 'solution_architect',
  review: 'qa_architect',
  generation: 'qa_architect',
  completed: 'qa_architect',
};

function buildSystemPrompt(project, agentType) {
  const agentDescriptions = {
    business_analyst: `You are a senior Business Analyst AI agent named "Alex". Your role is to conduct a thorough requirements discovery for a ${project.type?.replace(/_/g, ' ')} application called "${project.name}".

Ask ONE focused question at a time. Gather requirements across these areas progressively:
1. Business purpose and goals
2. Target users and their roles
3. Key business processes and workflows
4. Data the system needs to track
5. Reports and dashboards needed
6. Integrations with other systems
7. Security and compliance requirements

Be conversational, professional, and thorough. After collecting sufficient information (about 8-10 exchanges), summarize what you've learned and suggest moving to the Analysis phase.

Current project: ${project.name} (${project.type?.replace(/_/g, ' ')})
Industry: ${project.industry || 'Not specified'}`,

    product_manager: `You are a senior Product Manager AI agent named "Morgan". Based on the requirements gathered, generate a structured analysis.

When the user asks you to analyze or generate requirements, produce:
- Executive Summary
- Business Objectives (3-5 bullet points)
- User Personas (2-4 personas with name, role, and goals)
- Functional Requirements (grouped by module, numbered)
- Non-Functional Requirements (performance, security, scalability)
- User Stories (format: "As a [persona], I want to [action] so that [benefit]")

Format everything clearly with markdown headings. Be detailed and professional.`,

    solution_architect: `You are a senior Solution Architect AI agent named "Jordan". Design the system architecture for this application.

When asked, generate:
- System Architecture Overview
- Application Modules (with descriptions)
- Technology Stack Recommendations
- Integration Architecture
- Security Architecture
- Scalability Considerations

Use clear markdown formatting with sections and bullet points.`,

    db_architect: `You are a senior Database Architect AI agent named "Riley". Design the data model for this application.

When asked, generate database entities in this JSON format and also explain each entity:
- Entity Name
- Fields (name, type, required, description, constraints)
- Relationships to other entities
- Key indexes

Always present the schema as structured JSON code blocks AND human-readable explanations.`,

    ui_ux_architect: `You are a senior UI/UX Architect AI agent named "Casey". Design the user interface structure for this application.

When asked, generate:
- Navigation Structure (main menu, sub-menus)
- Page Inventory (list all pages with type and purpose)
- Key User Flows (step-by-step)
- Dashboard Layout Descriptions
- Form Specifications for key forms
- Mobile Considerations

Be specific about page types (dashboard, list, detail, form, report).`,

    backend_architect: `You are a senior Backend Architect AI agent named "Taylor". Design the backend architecture for this application.

When asked, generate:
- API Endpoint Specifications (method, path, description, request/response)
- Business Workflow Descriptions
- Automation Rules
- Notification Triggers
- Status Flow Diagrams (as text)
- Integration Specifications

Format API endpoints clearly with HTTP methods and example request/response schemas.`,

    qa_architect: `You are a senior QA Architect AI agent named "Sam". Review the complete application specification for completeness and quality.

When asked to review, check for:
- Missing functional requirements
- Unspecified user roles or permissions
- Data model gaps
- Missing API endpoints
- Undefined workflows
- Security considerations not addressed
- Performance requirements not specified

Provide a completeness score (0-100%) and a prioritized list of gaps to address. Be thorough and constructive.`,
  };

  return agentDescriptions[agentType] || agentDescriptions.business_analyst;
}

export default function ChatSection({ project, onRefresh }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeAgent, setActiveAgent] = useState(PHASE_AGENT_MAP[project.phase] || 'business_analyst');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    loadOrCreateConversation();
  }, [project.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const loadOrCreateConversation = async () => {
    setLoading(true);
    const convos = await base44.entities.Conversation.filter({ project_id: project.id, section: 'discovery' }, '-created_date', 1);
    if (convos.length > 0) {
      setConversation(convos[0]);
      setMessages(convos[0].messages || []);
      if (convos[0].agent_type) setActiveAgent(convos[0].agent_type);
    } else {
      // Create new conversation and send initial greeting
      const convo = await base44.entities.Conversation.create({
        project_id: project.id,
        section: 'discovery',
        agent_type: activeAgent,
        title: 'Requirements Discovery',
        messages: [],
        status: 'active',
      });
      setConversation(convo);
      setMessages([]);
      // Auto-greet
      await sendInitialGreeting(convo);
    }
    setLoading(false);
  };

  const sendInitialGreeting = async (convo) => {
    setSending(true);
    const greetingPrompt = `Introduce yourself briefly as the Business Analyst agent and ask the first discovery question for this project: "${project.name}" which is a ${project.type?.replace(/_/g, ' ')}${project.description ? `. Context: ${project.description}` : ''}. Start the requirements discovery process.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: greetingPrompt,
      model: 'claude_sonnet_4_6',
    });

    const assistantMsg = {
      id: Date.now().toString(),
      role: 'assistant',
      agent_type: 'business_analyst',
      content: response,
      timestamp: new Date().toISOString(),
    };

    const updated = [assistantMsg];
    await base44.entities.Conversation.update(convo.id, { messages: updated });
    setMessages(updated);
    setSending(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending || !conversation) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setSending(true);

    // Build conversation history for context
    const history = updatedMessages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n\n');
    const systemPrompt = buildSystemPrompt(project, activeAgent);

    const prompt = `${systemPrompt}

CONVERSATION HISTORY:
${history}

Respond to the user's latest message as the ${activeAgent.replace(/_/g, ' ')} agent. Be helpful, professional, and move the conversation forward productively. Use markdown formatting for structured content.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    const assistantMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      agent_type: activeAgent,
      content: response,
      timestamp: new Date().toISOString(),
    };

    const finalMessages = [...updatedMessages, assistantMsg];
    await base44.entities.Conversation.update(conversation.id, { messages: finalMessages, agent_type: activeAgent });
    setMessages(finalMessages);
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const switchAgent = async (agentType) => {
    setActiveAgent(agentType);
    if (conversation) {
      await base44.entities.Conversation.update(conversation.id, { agent_type: agentType });
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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50 overflow-x-auto flex-shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">Active Agent:</span>
        {AGENT_SEQUENCE.map(agentType => (
          <button
            key={agentType}
            onClick={() => switchAgent(agentType)}
            className={`flex-shrink-0 transition-all ${activeAgent === agentType ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
          >
            <AgentBadge agentType={agentType} size="sm" showLabel={false} />
          </button>
        ))}
        <div className="ml-auto flex-shrink-0">
          <AgentBadge agentType={activeAgent} size="sm" showLabel={true} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0">
        {messages.length === 0 && !sending && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Starting conversation...</p>
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
      <div className="border-t border-border p-4 bg-card flex-shrink-0">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${AGENTS[activeAgent]?.label || 'AI'}... (Enter to send)`}
              className="resize-none min-h-[44px] max-h-32 text-sm pr-3 py-3"
              rows={1}
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}