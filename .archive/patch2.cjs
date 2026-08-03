const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /setDiceValue\(\[Math\.floor\(Math\.random\(\) \* 6\) \+ 1, Math\.floor\(Math\.random\(\) \* 6\) \+ 1\]\);/g,
  `setDiceValue(Math.floor(Math.random() * 6) + 1);`
);

code = code.replace(
  /const r1 = Math\.floor\(Math\.random\(\) \* 6\) \+ 1;\s*const r2 = Math\.floor\(Math\.random\(\) \* 6\) \+ 1;\s*const finalRoll: \[number, number\] = \[r1, r2\];\s*const isDouble = r1 === r2;\s*const sum = r1 \+ r2;\s*setDiceValue\(finalRoll\);/,
  `const finalRoll = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalRoll);`
);

fs.writeFileSync('src/App.tsx', code);
