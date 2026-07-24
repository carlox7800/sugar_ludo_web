const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');
code = code.replace(
  /humanPlayerId,\n\}\) => \{/,
  'humanPlayerId,\n  appTheme,\n}) => {'
);
fs.writeFileSync('src/components/GameBoard.tsx', code);
