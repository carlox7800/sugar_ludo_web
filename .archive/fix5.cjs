const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/advanceTurn\(false, isDouble\);/g, 'advanceTurn(false, diceValues ? diceValues[0] === diceValues[1] : false);');
// Wait, I should ensure it doesn't break line 286 where `isDouble` is valid.
// I will just let it be replaced there too since it evaluates to the same thing, though using `diceValues` state inside `handleRollDice` might be slightly stale if React batches it. Let's fix line 286 back to `isDouble`.

fs.writeFileSync('src/App.tsx', code);
