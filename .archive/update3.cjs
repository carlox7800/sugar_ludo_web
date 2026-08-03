const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const getPlayableTokenIds = \(pId: number, diceVals: \[number, number\] \| null\): number\[\] => \{\s*if \(diceVals === null\) return \[\];\s*const totalRoll = diceVals\[0\] \+ diceVals\[1\];\s*const hasFive = diceVals\[0\] === 5 \|\| diceVals\[1\] === 5;/,
  `const getPlayableTokenIds = (pId: number, moves: number[]): number[] => {
    if (moves.length === 0) return [];
    const hasFive = moves.includes(5);`
);
fs.writeFileSync('src/App.tsx', code);
