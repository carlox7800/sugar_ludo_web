const fs = require('fs');

function processFile(path) {
  let code = fs.readFileSync(path, 'utf8');
  code = code.replace(/bg-\[#0a0a0f\]/g, 'bg-root');
  code = code.replace(/bg-\[#050508\]/g, 'bg-root');
  code = code.replace(/bg-\[#1a1a24\]/g, 'bg-panel');
  code = code.replace(/bg-\[#2d2d35\]/g, 'bg-border');
  code = code.replace(/border-\[#2d2d35\]/g, 'border-border');
  code = code.replace(/text-\[#e0e0e0\]/g, 'text-t-primary');
  code = code.replace(/text-\[#888891\]/g, 'text-t-muted');
  code = code.replace(/text-\[#00f2ff\]/g, 'text-p-blue');
  code = code.replace(/border-\[#00f2ff\]/g, 'border-p-blue');
  code = code.replace(/hover:bg-\[#00f2ff\]\/10/g, 'hover:bg-p-blue/10');
  code = code.replace(/text-\[#00ff95\]/g, 'text-p-green');
  code = code.replace(/text-\[#ff0055\]/g, 'text-p-red');
  code = code.replace(/text-\[#ffaa00\]/g, 'text-p-yellow');
  code = code.replace(/border-\[#ff0055\]/g, 'border-p-red');
  code = code.replace(/bg-\[#ff0055\]/g, 'bg-p-red');
  code = code.replace(/text-white/g, 'text-t-primary');
  fs.writeFileSync(path, code);
}

processFile('src/components/GameControls.tsx');
processFile('src/components/ConsoleLogs.tsx');
