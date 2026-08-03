const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

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

fs.writeFileSync('src/App.tsx', code);
