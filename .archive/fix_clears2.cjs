const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /if \(noMovesTimeoutRef\.current\) \{\s*clearTimeout\(noMovesTimeoutRef\.current\);\s*noMovesTimeoutRef\.current = null;\s*\}/,
  ``
);

fs.writeFileSync('src/App.tsx', code);
