const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const advanceTurnStart = code.indexOf('const advanceTurn = (extraTurn: boolean, rolledSix: boolean) => {');
const advanceTurnEnd = code.indexOf('  };', advanceTurnStart) + 4;

const newAdvanceTurn = `const advanceTurn = (extraTurn: boolean) => {
    setDiceValues(null);
    setHasRolled(false);
    setTimer(10);
    setConsecutiveSixes(0);

    if (winner !== null) return;

    if (extraTurn) {
      addLog(\`¡\${activePlayer.name} obtiene tiro adicional!\`, 'system');
      triggerTurnStart();
    } else {
      moveToNextPlayer();
    }
  };`;

code = code.substring(0, advanceTurnStart) + newAdvanceTurn + code.substring(advanceTurnEnd);

// Also replace the calls
code = code.replace(/advanceTurn\(false, isDouble\)/g, 'advanceTurn(false)');
code = code.replace(/advanceTurn\(true, isDouble\)/g, 'advanceTurn(true)');
code = code.replace(/advanceTurn\(false, diceValues \? diceValues\[0\] === diceValues\[1\] : false\)/g, 'advanceTurn(false)');
code = code.replace(/advanceTurn\(false, true\)/g, 'advanceTurn(false)');

fs.writeFileSync('src/App.tsx', code);
