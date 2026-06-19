import React from 'react';
import CalculatorFinalPreview from './CalculatorFinalPreview';
import GenericFinalPreview from './GenericFinalPreview';

function isCalculator(project, publishState) {
  const text = `${project?.name || ''} ${project?.description || ''} ${publishState?.code?.['🎨 src']?.['App.jsx'] || ''}`.toLowerCase();
  return text.includes('calculator') || text.includes('pressoperator');
}

export default function FinalAppPreview({ project, publishState }) {
  return <div className="rounded-xl border border-border bg-card overflow-hidden">
    <div className="px-4 py-3 border-b border-border bg-muted/20"><p className="text-xs font-semibold text-foreground">Wrapped Final App Preview</p><p className="text-[11px] text-muted-foreground">Use the buttons below to interact with the generated app experience.</p></div>
    {isCalculator(project, publishState) ? <CalculatorFinalPreview title={project?.name || 'Calculator'} /> : <GenericFinalPreview project={project} publishState={publishState} />}
  </div>;
}