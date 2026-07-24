const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /if \(botTimeoutRef\.current\) \{\s*clearTimeout\(botTimeoutRef\.current\);\s*botTimeoutRef\.current = null;\s*\}/,
  `if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    if (noMovesTimeoutRef.current) {
      clearTimeout(noMovesTimeoutRef.current);
      noMovesTimeoutRef.current = null;
    }`
);

fs.writeFileSync('src/App.tsx', code);
