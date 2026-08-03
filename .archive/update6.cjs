const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const moveToken = \(tokenId: number, rollValue: number\) => \{/,
  `const moveToken = (tokenId: number, moveVal: number, moveIndex: number) => {`
);

code = code.replace(
  /let targetStep = startStep \+ rollValue;\s*if \(startStep === 0\) \{\s*if \(rollValue > 5\) \{\s*targetStep = 1 \+ \(rollValue \- 5\);\s*\} else \{\s*targetStep = 1;\s*\}\s*\}/,
  `let targetStep = startStep + moveVal;
    if (startStep === 0) {
       targetStep = 1;
    }`
);

code = code.replace(
  /handleMoveCompletion\(playerIndex, tokenIndex, targetStep, rollValue\);/,
  `handleMoveCompletion(playerIndex, tokenIndex, targetStep, moveIndex);`
);

fs.writeFileSync('src/App.tsx', code);
