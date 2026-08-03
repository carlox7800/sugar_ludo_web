const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const finalRoll: \[number, number\] = \[r1, r2\];\s*const isDouble = r1 === r2;\s*const sum = r1 \+ r2;\s*setDiceValues\(finalRoll\);\s*setIsRolling\(false\);\s*setHasRolled\(true\);/,
  `const finalRoll: [number, number] = [r1, r2];
        const isDouble = r1 === r2;
        const sum = r1 + r2;
        setDiceValues(finalRoll);
        setRemainingMoves([...finalRoll]);
        setIsRolling(false);
        setHasRolled(true);`
);

fs.writeFileSync('src/App.tsx', code);
