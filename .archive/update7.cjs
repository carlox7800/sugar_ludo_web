const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const handleMoveCompletion = \(pId: number, tId: number, finalStep: number, rollValue: number\) => \{/,
  `const handleMoveCompletion = (pId: number, tId: number, finalStep: number, moveIndex: number) => {`
);

// We need to replace the end logic of handleMoveCompletion.
// Right now it ends with:
//       advanceTurn(extraTurnGrant, diceValues ? diceValues[0] === diceValues[1] : false);
//     }
//   };
// We need to replace it carefully.

const regex = /advanceTurn\(extraTurnGrant, diceValues \? diceValues\[0\] === diceValues\[1\] : false\);\s*\}\s*\};/;

const newEndLogic = `
      setRemainingMoves(prev => {
        const newMoves = [...prev];
        newMoves.splice(moveIndex, 1);
        
        if (extraTurnGrant) {
          // If they got an extra turn, clear remaining moves to allow new roll
          setIsAnimatingMove(false);
          advanceTurn(true, diceValues ? diceValues[0] === diceValues[1] : false);
          return [];
        } else if (newMoves.length === 0) {
          setIsAnimatingMove(false);
          advanceTurn(false, diceValues ? diceValues[0] === diceValues[1] : false);
          return [];
        } else {
          setIsAnimatingMove(false);
          // Check if they have playable moves with remaining moves
          const stillPlayable = getPlayableTokenIds(pId, newMoves);
          if (stillPlayable.length === 0) {
            advanceTurn(false, diceValues ? diceValues[0] === diceValues[1] : false);
            return [];
          }
          return newMoves;
        }
      });
    }
  };`;

code = code.replace(regex, newEndLogic);
fs.writeFileSync('src/App.tsx', code);
