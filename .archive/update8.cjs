const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /setIsAnimatingMove\(false\);\s*\/\/ Check if player rolled doubles for an extra turn\s*const isDouble = diceValues \? diceValues\[0\] === diceValues\[1\] : false;\s*advanceTurn\(extraTurnGrant, isDouble\);\s*\};/;

const newEndLogic = `
    const isDouble = diceValues ? diceValues[0] === diceValues[1] : false;
    setRemainingMoves(prev => {
      const newMoves = [...prev];
      newMoves.splice(moveIndex, 1);
      
      if (extraTurnGrant) {
        setIsAnimatingMove(false);
        advanceTurn(true, isDouble);
        return [];
      } else if (newMoves.length === 0) {
        setIsAnimatingMove(false);
        advanceTurn(false, isDouble);
        return [];
      } else {
        setIsAnimatingMove(false);
        const stillPlayable = getPlayableTokenIds(pId, newMoves);
        if (stillPlayable.length === 0) {
          advanceTurn(false, isDouble);
          return [];
        }
        return newMoves;
      }
    });
  };`;

code = code.replace(regex, newEndLogic);
fs.writeFileSync('src/App.tsx', code);
