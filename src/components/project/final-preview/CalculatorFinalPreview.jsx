import React, { useState } from 'react';

const rows = [['C','√','%','CE'], ['7','8','9','+'], ['4','5','6','×'], ['1','2','3','−'], ['0','.','.','=']];
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;

export default function CalculatorFinalPreview({ title = 'Calculator' }) {
  const [display, setDisplay] = useState('0');
  const [stored, setStored] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const format = v => Number.isFinite(v) ? String(Number(v.toFixed(10))) : 'Error';
  const calc = (a, o, b) => o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : b;
  const clear = () => { setDisplay('0'); setStored(null); setOp(null); setFresh(true); };
  const digit = key => { if (key === '.' && display.includes('.') && !fresh) return; setDisplay(fresh ? (key === '.' ? '0.' : key) : (display === '0' && key !== '.' ? key : display + key)); setFresh(false); };
  const operator = key => { const current = num(display); if (stored !== null && op && !fresh) { const next = calc(stored, op, current); setStored(next); setDisplay(format(next)); } else setStored(current); setOp(key); setFresh(true); };
  const equals = () => { if (stored === null || !op) return; const next = calc(stored, op, num(display)); setDisplay(format(next)); setStored(null); setOp(null); setFresh(true); };
  const press = key => { if (/^[0-9.]$/.test(key)) digit(key); else if (key === 'C') clear(); else if (key === 'CE') { setDisplay('0'); setFresh(true); } else if (key === '√') { setDisplay(format(Math.sqrt(Math.max(0, num(display))))); setFresh(true); } else if (key === '%') { setDisplay(format(num(display) / 100)); setFresh(true); } else if (key === '=') equals(); else operator(key); };

  return <div className="bg-[#d9d9dc] flex justify-center p-0 sm:p-6 min-h-[620px]">
    <section className="w-full max-w-[680px] bg-[#dedee2] border-4 border-[#77777c] rounded-md overflow-hidden shadow-2xl">
      <header className="h-[86px] bg-[#c5c5c9] flex items-center px-5 border-b border-[#b6b6bb]"><h1 className="text-[46px] text-black flex-1 font-normal">{title}</h1><button onClick={() => setMinimized(v => !v)} className="w-16 h-16 mr-3 rounded-md border-2 border-[#808086] bg-[#f3f3f5] text-black text-6xl leading-none">−</button><button onClick={clear} className="w-16 h-16 rounded-md border-2 border-[#808086] bg-[#f3f3f5] text-black text-6xl leading-none">×</button></header>
      {!minimized && <div className="p-5 sm:p-6 space-y-8"><div className="h-[190px] bg-[#f7f7f8] border-4 border-[#77777c] rounded-md flex items-center justify-end px-6"><span className="text-[130px] leading-none text-black tabular-nums truncate">{display}</span></div><div className="grid grid-cols-4 gap-4">{rows.flat().map((key, i) => <button key={key+i} onClick={() => press(key)} className="h-[88px] rounded-md border-4 border-[#85858b] bg-[#c9c9cd] hover:bg-[#d5d5d9] active:bg-[#b9b9be] text-black text-[64px] leading-none flex items-center justify-center transition-colors">{key}</button>)}</div></div>}
    </section>
  </div>;
}