const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "if (validMoveIndices.length === 1 || new Set(validMoveIndices.map(i => remainingMoves[i])).size === 1) {",
  "if (validMoveIndices.length === 1 || (token.step === 0 && new Set(validMoveIndices.map(i => remainingMoves[i])).size === 1)) {"
);
fs.writeFileSync('src/App.tsx', code);
