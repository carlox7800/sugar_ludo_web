const fs = require('fs');
let code = fs.readFileSync('src/GameEngine.tsx', 'utf-8');

code = code.replace(
  "const saved = localStorage.getItem('sugar_ludo_profile');",
  "const saved = typeof window !== 'undefined' ? localStorage.getItem('sugar_ludo_profile') : null;"
);

code = code.replace(
  "localStorage.setItem('sugar_ludo_profile', JSON.stringify(userProfile));",
  "if (typeof window !== 'undefined') { localStorage.setItem('sugar_ludo_profile', JSON.stringify(userProfile)); }"
);

fs.writeFileSync('src/GameEngine.tsx', code);
