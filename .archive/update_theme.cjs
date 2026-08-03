const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

const themeBlock = `
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  --color-root: var(--bg-root);
  --color-panel: var(--bg-panel);
  --color-board: var(--bg-board);
  --color-border: var(--border-color);
  --color-t-primary: var(--text-primary);
  --color-t-muted: var(--text-muted);
  --color-p-red: var(--color-red);
  --color-p-green: var(--color-green);
  --color-p-blue: var(--color-blue);
  --color-p-yellow: var(--color-yellow);
}
`;
code = code.replace(/@theme\s*\{[\s\S]*?\}/, themeBlock);
fs.writeFileSync('src/index.css', code);
