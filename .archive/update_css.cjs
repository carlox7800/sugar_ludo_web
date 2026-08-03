const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code += `
@layer base {
  :root {
    --bg-root: #050508;
    --bg-panel: #1a1a24;
    --bg-board: #0a0a0f;
    --border-color: #2d2d35;
    --text-primary: #e0e0e0;
    --text-muted: #888891;
    --color-red: #ff0055;
    --color-green: #059669;
    --color-blue: #0284c7;
    --color-yellow: #ca8a04;
    --color-red-light: rgba(255, 0, 85, 0.12);
    --color-green-light: rgba(5, 150, 105, 0.12);
    --color-blue-light: rgba(2, 132, 199, 0.12);
    --color-yellow-light: rgba(202, 138, 4, 0.12);
    --shadow-color: rgba(0, 0, 0, 0.5);
  }

  .theme-sugar {
    --bg-root: #fff0f5; /* LavenderBlush */
    --bg-panel: #ffffff;
    --bg-board: #ffe4e1; /* MistyRose */
    --border-color: #ffb6c1; /* LightPink */
    --text-primary: #831843;
    --text-muted: #db2777;
    --color-red: #fb7185;
    --color-green: #34d399;
    --color-blue: #38bdf8;
    --color-yellow: #facc15;
    --color-red-light: rgba(251, 113, 133, 0.2);
    --color-green-light: rgba(52, 211, 153, 0.2);
    --color-blue-light: rgba(56, 189, 248, 0.2);
    --color-yellow-light: rgba(250, 204, 21, 0.2);
    --shadow-color: rgba(255, 182, 193, 0.5);
  }

  body {
    background-color: var(--bg-root);
    color: var(--text-primary);
  }
}
`;
fs.writeFileSync('src/index.css', code);
