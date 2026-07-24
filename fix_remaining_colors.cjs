const fs = require('fs');

function processFile(path) {
  let code = fs.readFileSync(path, 'utf8');

  // Replace Hex Codes with generic Tailwind classes based on variables
  code = code.replace(/#0a0a0f/g, 'var(--bg-board)');
  code = code.replace(/#050508/g, 'var(--bg-root)');
  code = code.replace(/#1a1a24/g, 'var(--bg-panel)');
  code = code.replace(/#2d2d35/g, 'var(--border-color)');
  code = code.replace(/#e0e0e0/g, 'var(--text-primary)');
  code = code.replace(/#888891/g, 'var(--text-muted)');
  code = code.replace(/#00f2ff/g, 'var(--color-p-blue)');
  code = code.replace(/#00ff95/g, 'var(--color-p-green)');
  code = code.replace(/#ff0055/g, 'var(--color-p-red)');
  code = code.replace(/#ffaa00/g, 'var(--color-p-yellow)');
  code = code.replace(/#050506/g, 'var(--bg-root)'); // closely matches root

  fs.writeFileSync(path, code);
}

processFile('src/components/GameControls.tsx');
