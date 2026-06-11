import React from 'react';
import { getAgent } from './AgentBadge';

export default function TypingIndicator({ agentType = 'business_analyst' }) {
  const agent = getAgent(agentType);
  const Icon = agent.icon;

  return (
    <div className="flex gap-3 mb-4 animate-fade-in">
      <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${agent.bgClass}`}>
        <Icon className={`w-4 h-4 ${agent.colorClass}`} />
      </div>
      <div className={`rounded-2xl rounded-tl-sm px-4 py-3 border ${agent.bgClass} flex items-center gap-1.5`}>
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}