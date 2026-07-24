const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const hasFive = moves\.includes\(5\);/;
const replacement = `const hasFive = moves.includes(5);
    const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5;`;

code = code.replace(regex, replacement);

const regex2 = /if \(hasFive\) \{/;
const replacement2 = `if (hasFive || hasSumFive) {`;
code = code.replace(regex2, replacement2);

fs.writeFileSync('src/App.tsx', code);
