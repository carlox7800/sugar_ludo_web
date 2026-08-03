const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/diceValuess/g, 'diceValues');
code = code.replace(/diceValue/g, 'diceValues');
code = code.replace(/setDiceValue\(/g, 'setDiceValues(');

fs.writeFileSync('src/App.tsx', code);
