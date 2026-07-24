const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex1 = /\} else if \(hasRolled && !isRolling && !isAnimatingMove\) \{\s*\/\/ Auto move best token\s*const pTokens = getPlayableTokenIds\(currentTurn, diceValues\);\s*if \(pTokens\.length > 0\) \{\s*const rollSum = diceValues \? diceValues\[0\] \+ diceValues\[1\] : 1;\s*const bestTokenId = getBestBotMove\(currentTurn, rollSum, pTokens\);\s*if \(bestTokenId !== \-1\) \{\s*moveToken\(bestTokenId, rollSum\);\s*\}\s*\} else \{\s*\/\/ No moves, pass turn\s*advanceTurn\(false, diceValues \? diceValues\[0\] === diceValues\[1\] : false\);\s*\}\s*\}/;

const replace1 = `} else if (hasRolled && !isRolling && !isAnimatingMove) {
      const pTokens = getPlayableTokenIds(currentTurn, remainingMoves);
      if (pTokens.length > 0) {
        const bestMove = getBestBotMove(currentTurn, remainingMoves, pTokens);
        if (bestMove) {
          moveToken(bestMove.tokenId, bestMove.moveVal, bestMove.moveIndex);
        }
      } else {
        advanceTurn(false, diceValues ? diceValues[0] === diceValues[1] : false);
      }
    }`;

code = code.replace(regex1, replace1);

const regex2 = /\} else if \(hasRolled && !isRolling\) \{\s*\/\/ Wait 0\.8s before Bot selects and moves their token\s*const pTokens = getPlayableTokenIds\(currentTurn, diceValues\);\s*if \(pTokens\.length > 0\) \{\s*const rollSum = diceValues \? diceValues\[0\] \+ diceValues\[1\] : 1;\s*const bestTokenId = getBestBotMove\(currentTurn, rollSum, pTokens\);\s*botTimeoutRef\.current = window\.setTimeout\(\(\) => \{\s*if \(bestTokenId !== \-1\) \{\s*moveToken\(bestTokenId, rollSum\);\s*\}\s*\}, 900\);\s*\} else \{\s*\/\/ No moves available, pass turn\s*botTimeoutRef\.current = window\.setTimeout\(\(\) => \{\s*advanceTurn\(false, diceValues \? diceValues\[0\] === diceValues\[1\] : false\);\s*\}, 800\);\s*\}\s*\}/;

const replace2 = `} else if (hasRolled && !isRolling) {
        const pTokens = getPlayableTokenIds(currentTurn, remainingMoves);
        if (pTokens.length > 0) {
          const bestMove = getBestBotMove(currentTurn, remainingMoves, pTokens);
          botTimeoutRef.current = window.setTimeout(() => {
            if (bestMove) {
              moveToken(bestMove.tokenId, bestMove.moveVal, bestMove.moveIndex);
            }
          }, 900);
        } else {
          botTimeoutRef.current = window.setTimeout(() => {
            advanceTurn(false, diceValues ? diceValues[0] === diceValues[1] : false);
          }, 800);
        }
      }`;

code = code.replace(regex2, replace2);

code = code.replace(
  /}, \[isPlaying, currentTurn, hasRolled, isRolling, isAnimatingMove, winner, diceValues\]\);/,
  `}, [isPlaying, currentTurn, hasRolled, isRolling, isAnimatingMove, winner, remainingMoves]);`
);

const regex3 = /const handleTokenClick = \(tokenId: number\) => \{\s*if \(activePlayer\.type !== 'human' \|\| isAnimatingMove \|\| isRolling \|\| !hasRolled\) return;\s*\/\/ Check if selected token is playable\s*if \(playableTokenIds\.includes\(tokenId\)\) \{\s*const rollSum = diceValues \? diceValues\[0\] \+ diceValues\[1\] : 1;\s*moveToken\(tokenId, rollSum\);\s*\}\s*\};/;

const replace3 = `const handleTokenClick = (tokenId: number) => {
    if (activePlayer.type !== 'human' || isAnimatingMove || isRolling || !hasRolled) return;

    if (playableTokenIds.includes(tokenId)) {
      const tokenIndex = tokenId % 4;
      const playerIndex = Math.floor(tokenId / 4);
      const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex);
      if (!token) return;

      const validMoveIndices: number[] = [];
      remainingMoves.forEach((m, idx) => {
        let isValid = false;
        if (token.step === 0) {
          if (m === 5) {
             const startIdx = START_OFFSETS[token.color];
             isValid = !tokens.some(tk => tk.step > 0 && tk.step <= 51 && ((START_OFFSETS[tk.color] + tk.step - 1) % 52) === startIdx && tk.color === token.color);
          }
        } else if (token.step > 0 && token.step + m <= 57) {
          let blocked = false;
          for (let stepOffset = 1; stepOffset <= m; stepOffset++) {
            const pathStep = token.step + stepOffset;
            if (pathStep <= 51) {
              const pIndex = (START_OFFSETS[token.color] + pathStep - 1) % 52;
              const counts: Record<string, number> = {};
              tokens.forEach(tk => {
                if (tk.step > 0 && tk.step <= 51) {
                  const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
                  if (tkIdx === pIndex) {
                    counts[tk.color] = (counts[tk.color] || 0) + 1;
                  }
                }
              });
              if (Object.values(counts).some(count => count >= 2)) {
                blocked = true;
                break;
              }
            }
          }
          isValid = !blocked;
        }
        if (isValid) validMoveIndices.push(idx);
      });

      if (validMoveIndices.length === 0) return;
      if (validMoveIndices.length === 1 || new Set(validMoveIndices.map(i => remainingMoves[i])).size === 1) {
         const idx = validMoveIndices[0];
         moveToken(tokenId, remainingMoves[idx], idx);
      } else {
         setMoveSelectorTokenId(tokenId);
      }
    }
  };`;

code = code.replace(regex3, replace3);

fs.writeFileSync('src/App.tsx', code);
