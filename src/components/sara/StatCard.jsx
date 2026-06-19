import React from 'react';

export default function StatCard({ label, value, hint }) {
  return <div className="bg-card border border-border rounded-2xl p-5 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-bold mt-2">{value}</p>{hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}</div>;
}