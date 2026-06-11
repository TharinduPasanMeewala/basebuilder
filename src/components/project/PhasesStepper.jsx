import React from 'react';
import { Check, Circle, Lock } from 'lucide-react';

const PHASES = [
  { key: 'discovery', label: 'Discovery', short: '1' },
  { key: 'analysis', label: 'Analysis', short: '2' },
  { key: 'design', label: 'Design', short: '3' },
  { key: 'architecture', label: 'Architecture', short: '4' },
  { key: 'review', label: 'QA Review', short: '5' },
  { key: 'generation', label: 'Generation', short: '6' },
  { key: 'completed', label: 'Complete', short: '✓' },
];

const phaseOrder = PHASES.map(p => p.key);

function getPhaseStatus(phaseKey, currentPhase) {
  const current = phaseOrder.indexOf(currentPhase);
  const target = phaseOrder.indexOf(phaseKey);
  if (target < current) return 'completed';
  if (target === current) return 'active';
  return 'pending';
}

export default function PhasesStepper({ currentPhase = 'discovery', onPhaseClick }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {PHASES.map((phase, index) => {
        const status = getPhaseStatus(phase.key, currentPhase);
        return (
          <React.Fragment key={phase.key}>
            <button
              onClick={() => status !== 'pending' && onPhaseClick?.(phase.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                status === 'active'
                  ? 'bg-primary text-primary-foreground'
                  : status === 'completed'
                  ? 'text-accent cursor-pointer hover:bg-accent/10'
                  : 'text-muted-foreground cursor-default'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                status === 'active' ? 'bg-primary-foreground/20' :
                status === 'completed' ? 'bg-accent/20' :
                'bg-muted'
              }`}>
                {status === 'completed' ? <Check className="w-2.5 h-2.5" /> : phase.short}
              </span>
              <span className="hidden sm:inline">{phase.label}</span>
            </button>
            {index < PHASES.length - 1 && (
              <div className={`h-px w-4 flex-shrink-0 mx-0.5 ${
                getPhaseStatus(PHASES[index + 1].key, currentPhase) !== 'pending' ? 'bg-accent/40' : 'bg-border'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}