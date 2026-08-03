const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const getPlayableTokenIds = \(pId: number, diceVals: \[number, number\] \| null\): number\[\] => \{[\s\S]*?const hasFive = diceVals\[0\] === 5 || diceVals\[1\] === 5;/,
  `const getPlayableTokenIds = (pId: number, diceVal: number | null): number[] => {
    if (diceVal === null) return [];
    
    const totalRoll = diceVal;
    const hasFive = diceVal === 5;`
);

fs.writeFileSync('src/App.tsx', code);
