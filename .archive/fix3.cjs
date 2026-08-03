const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/diceValuess/g, 'diceValues');

code = code.replace(/advanceTurn\(false, isDouble\);/g, 'advanceTurn(false, diceValues ? diceValues[0] === diceValues[1] : false);');
// Wait, at line 286, `isDouble` is defined in the block. So I shouldn't blindly replace it. 
// I'll manually handle the replacements.

fs.writeFileSync('src/App.tsx', code);
