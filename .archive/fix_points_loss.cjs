const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add pendingExtraTurnsRef
code = code.replace(
  /const botTimeoutRef = useRef<number \| null>\(null\);/,
  `const botTimeoutRef = useRef<number | null>(null);\n  const pendingExtraTurnsRef = useRef<number>(0);`
);

// 2. Modify moveToken to compute leftover and pass to handleMoveCompletion
const moveTokenOld = /let targetStep = startStep \+ moveVal;\n\s*if \(startStep === 0\) \{\s*targetStep = 1;\n\s*\}/;
const moveTokenNew = `let targetStep = startStep + moveVal;
    let leftover = 0;
    if (startStep === 0) {
       targetStep = 1;
    } else if (targetStep > 57) {
       leftover = targetStep - 57;
       targetStep = 57;
    }`;
code = code.replace(moveTokenOld, moveTokenNew);

code = code.replace(
  /handleMoveCompletion\(playerIndex, tokenIndex, targetStep, moveIndices\);/g,
  `handleMoveCompletion(playerIndex, tokenIndex, targetStep, moveIndices, leftover);`
);

// 3. Modify handleMoveCompletion signature and logic
const handleMoveOld = /const handleMoveCompletion = \(pId: number, tId: number, finalStep: number, moveIndices: number\[\]\) => \{/;
const handleMoveNew = `const handleMoveCompletion = (pId: number, tId: number, finalStep: number, moveIndices: number[], leftover: number = 0) => {`;
code = code.replace(handleMoveOld, handleMoveNew);

// 4. Update the setRemainingMoves block inside handleMoveCompletion
const setRemainingMovesOldRegex = /setRemainingMoves\(prev => \{[\s\S]*?\}\);/m;

const setRemainingMovesNew = `setRemainingMoves(prev => {
      const newMoves = [...prev];
      [...moveIndices].sort((a, b) => b - a).forEach(idx => newMoves.splice(idx, 1));
      
      if (leftover > 0) {
        newMoves.push(leftover);
      }

      if (extraTurnGrant) {
        pendingExtraTurnsRef.current += 1;
      }

      setIsAnimatingMove(false);

      if (newMoves.length === 0) {
        if (pendingExtraTurnsRef.current > 0) {
          pendingExtraTurnsRef.current -= 1;
          advanceTurn(true);
        } else {
          advanceTurn(false);
        }
        return [];
      } else {
        const stillPlayable = getPlayableTokenIds(pId, newMoves, updatedTokens);
        if (stillPlayable.length === 0) {
          if (pendingExtraTurnsRef.current > 0) {
            pendingExtraTurnsRef.current -= 1;
            advanceTurn(true);
          } else {
            advanceTurn(false);
          }
          return [];
        }
        return newMoves;
      }
    });`;

code = code.replace(setRemainingMovesOldRegex, setRemainingMovesNew);

fs.writeFileSync('src/App.tsx', code);
