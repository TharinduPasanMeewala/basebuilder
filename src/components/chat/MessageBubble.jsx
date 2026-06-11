import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, ChevronDown, ChevronUp, Image, Link } from 'lucide-react';
import AgentBadge, { getAgent } from './AgentBadge';

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group rounded-md overflow-hidden border border-border mt-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{language || 'json'}</span>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono overflow-x-auto bg-card text-foreground leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ArtifactCard({ artifact }) {
  const [expanded, setExpanded] = useState(false);
  if (!artifact) return null;
  return (
    <div className="mt-2 border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-xs font-medium"
      >
        <span className="text-foreground">{artifact.title || 'Generated Artifact'}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {expanded && (
        <div className="p-3">
          <CodeBlock code={typeof artifact.content === 'object' ? JSON.stringify(artifact.content, null, 2) : artifact.content} language={artifact.language || 'json'} />
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    const imageUrls = (message.file_urls || []).filter(u => /\.(png|jpg|jpeg|gif|webp|svg)/i.test(u) || u.includes('/images/'));
    const linkUrls = (message.file_urls || []).filter(u => !imageUrls.includes(u));
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[75%] space-y-1.5">
          {imageUrls.map((url, i) => (
            <img key={i} src={url} alt="attachment" className="rounded-xl max-h-48 object-cover ml-auto block border border-border" />
          ))}
          {linkUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-primary/20 text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:underline">
              <Link className="w-3 h-3" />{url.slice(0, 60)}{url.length > 60 ? '…' : ''}
            </a>
          ))}
          {message.content && (
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
              {message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  const agent = getAgent(message.agent_type || 'business_analyst');
  const Icon = agent.icon;

  return (
    <div className="flex gap-3 mb-4 animate-fade-in">
      <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${agent.bgClass}`}>
        <Icon className={`w-4 h-4 ${agent.colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <AgentBadge agentType={message.agent_type || 'business_analyst'} size="sm" showLabel={true} />
          <span className="text-xs text-muted-foreground">
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 border ${agent.bgClass}`}>
          <div className="text-sm leading-relaxed prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  if (inline) {
                    return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
                  }
                  const lang = className?.replace('language-', '') || 'json';
                  return <CodeBlock code={String(children).replace(/\n$/, '')} language={lang} />;
                },
                p({ children }) { return <p className="mb-2 last:mb-0 text-foreground">{children}</p>; },
                ul({ children }) { return <ul className="list-disc list-inside space-y-1 mb-2 text-foreground">{children}</ul>; },
                ol({ children }) { return <ol className="list-decimal list-inside space-y-1 mb-2 text-foreground">{children}</ol>; },
                strong({ children }) { return <strong className="font-semibold text-foreground">{children}</strong>; },
                h3({ children }) { return <h3 className="font-semibold text-foreground text-sm mt-3 mb-1">{children}</h3>; },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          {message.artifacts?.map((artifact, i) => (
            <ArtifactCard key={i} artifact={artifact} />
          ))}
        </div>
      </div>
    </div>
  );
}