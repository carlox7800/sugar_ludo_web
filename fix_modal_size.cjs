const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<div className="bg-\[#1a1a24\] border border-\[#2d2d35\] p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-\[200px\] w-full animate-in fade-in zoom-in-95 duration-200">/;
const replacement = `<div className="bg-[#1a1a24] border border-[#2d2d35] p-3 rounded-2xl shadow-xl flex flex-col gap-2 max-w-[160px] w-full animate-in fade-in zoom-in-95 duration-200">`;
code = code.replace(regex, replacement);

const regex2 = /<h3 className="text-\[#e0e0e0\] font-black text-base text-center font-mono uppercase tracking-wider">Mover<\/h3>/;
const replacement2 = `<h3 className="text-[#e0e0e0] font-bold text-xs text-center font-mono uppercase tracking-wider">Mover</h3>`;
code = code.replace(regex2, replacement2);

const regex3 = /className="w-14 h-14 bg-\[#2d2d35\]/g;
const replacement3 = `className="w-12 h-12 bg-[#2d2d35]`;
code = code.replace(regex3, replacement3);

fs.writeFileSync('src/App.tsx', code);
