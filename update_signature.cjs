const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const moveToken = \(tokenId: number, moveVal: number, moveIndex: number\) => \{/,
  `const moveToken = (tokenId: number, moveVal: number, moveIndices: number[]) => {`
);

code = code.replace(
  /handleMoveCompletion\(playerIndex, tokenIndex, targetStep, moveIndex\);/,
  `handleMoveCompletion(playerIndex, tokenIndex, targetStep, moveIndices);`
);

code = code.replace(
  /const handleMoveCompletion = \(pId: number, tId: number, finalStep: number, moveIndex: number\) => \{/,
  `const handleMoveCompletion = (pId: number, tId: number, finalStep: number, moveIndices: number[]) => {`
);

const oldSplice = /const newMoves = \[\.\.\.prev\];\s*newMoves\.splice\(moveIndex, 1\);/;
const newSplice = `const newMoves = [...prev];
      // Sort indices descending so splicing doesn't shift subsequent indices
      [...moveIndices].sort((a, b) => b - a).forEach(idx => newMoves.splice(idx, 1));`;

code = code.replace(oldSplice, newSplice);

fs.writeFileSync('src/App.tsx', code);
