const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/const \[diceValue, setDiceValue\] = useState<number \| null>\(null\);/g, 'const [diceValues, setDiceValues] = useState<[number, number] | null>(null);');
code = code.replace(/diceValue={diceValue}/g, 'diceValues={diceValues}');
code = code.replace(/diceValue/g, 'diceValues');

code = code.replace(
  /const finalRoll = Math\.floor\(Math\.random\(\) \* 6\) \+ 1;\s*setDiceValues\(finalRoll\);\s*setIsRolling\(false\);/,
  `const r1 = Math.floor(Math.random() * 6) + 1;
        const r2 = Math.floor(Math.random() * 6) + 1;
        const finalRoll: [number, number] = [r1, r2];
        const isDouble = r1 === r2;
        const sum = r1 + r2;
        setDiceValues(finalRoll);
        setIsRolling(false);`
);

code = code.replace(/lanzó el dado y sacó un \$\{finalRoll\}/g, 'lanzó los dados y sacó ${r1} y ${r2} (Total: ${sum})');

// We replaced advanceTurn calls earlier, let's restore them carefully.
code = code.replace(/advanceTurn\(false, finalRoll === 6\);/g, 'advanceTurn(false, isDouble);');
code = code.replace(/advanceTurn\(false, diceValues === 6\);/g, 'advanceTurn(false, isDouble);');
code = code.replace(/advanceTurn\(extraTurnGrant, rollValue === 6\);/g, 'advanceTurn(extraTurnGrant, isDouble);');

code = code.replace(
  /const getPlayableTokenIds = \(pId: number, diceValues: number \| null\): number\[\] => \{\s*if \(diceValues === null\) return \[\];\s*const totalRoll = diceValues;\s*const hasFive = diceValues === 5;/,
  `const getPlayableTokenIds = (pId: number, diceVals: [number, number] | null): number[] => {
    if (diceVals === null) return [];
    
    const totalRoll = diceVals[0] + diceVals[1];
    const hasFive = diceVals[0] === 5 || diceVals[1] === 5;`
);
code = code.replace(/getPlayableTokenIds\(currentTurn, diceValues\)/g, 'getPlayableTokenIds(currentTurn, diceValues)'); // should be correct already

code = code.replace(/const rollSum = diceValues \|\| 1;/g, 'const rollSum = diceValues ? diceValues[0] + diceValues[1] : 1;');
code = code.replace(/const isDouble = false;/g, 'const isDouble = diceValues ? diceValues[0] === diceValues[1] : false;');

code = code.replace(
  /setDiceValues\(Math\.floor\(Math\.random\(\) \* 6\) \+ 1\);/g,
  `setDiceValues([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);`
);

fs.writeFileSync('src/App.tsx', code);
