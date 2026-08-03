const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const getPlayableTokenIds = \(pId: number, diceVal: number \| null\): number\[\] => \{\s*if \(diceVal === null\) return \[\];\s*const totalRoll = diceVal;\s*const hasFive = diceVal === 5;/,
  `const getPlayableTokenIds = (pId: number, diceVals: [number, number] | null): number[] => {
    if (diceVals === null) return [];
    const totalRoll = diceVals[0] + diceVals[1];
    const hasFive = diceVals[0] === 5 || diceVals[1] === 5;`
);

fs.writeFileSync('src/App.tsx', code);
