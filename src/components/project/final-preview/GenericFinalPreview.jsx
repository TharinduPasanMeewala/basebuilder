import React from 'react';
import LivePreviewSection from '@/components/LivePreviewSection';

export default function GenericFinalPreview({project,theme={}}){
 const overrides=Object.fromEntries([['background_color',theme.page],['surface_color',theme.surface],['primary_color',theme.primary],['text_color',theme.text],['sidebar_color',theme.sidebar]].filter(([,value])=>value));
 return <div className="h-[720px] min-h-0 flex flex-col"><p className="text-[11px] text-muted-foreground px-4 py-2 border-b border-border">Interactive specification preview. Run the downloaded app to test exported code changes.</p><LivePreviewSection project={project} designOverride={overrides}/></div>;
}
