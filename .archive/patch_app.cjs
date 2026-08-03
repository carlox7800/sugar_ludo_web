const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const isStartCell = \[2, 15, 28, 41\]\.includes\(pIndex\);/,
  `const isStartCell = [1, 14, 27, 40].includes(pIndex);`
);

fs.writeFileSync('src/App.tsx', code);
