const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const playableTokenIds = hasRolled && !isRolling && !isAnimatingMove && activePlayer\s*\?\s*getPlayableTokenIds\(currentTurn, diceValues\)\s*:\s*\[\];/,
  `const playableTokenIds = hasRolled && !isRolling && !isAnimatingMove && activePlayer
    ? getPlayableTokenIds(currentTurn, remainingMoves)
    : [];`
);

code = code.replace(/const moves = getPlayableTokenIds\(currentTurn, finalRoll\);/, `const moves = getPlayableTokenIds(currentTurn, [r1, r2]);`);

fs.writeFileSync('src/App.tsx', code);
