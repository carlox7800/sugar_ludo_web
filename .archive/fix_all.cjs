const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Rewrite advanceTurn entirely
const advanceTurnRegex = /const advanceTurn = \([\s\S]*?\/\/ Proceed to next player\s*moveToNextPlayer\(\);\s*\}/;
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
  }`;
code = code.replace(advanceTurnRegex, newAdvanceTurn);

// Replace advanceTurn calls
code = code.replace(/advanceTurn\(false, isDouble\)/g, 'advanceTurn(false)');
code = code.replace(/advanceTurn\(true, isDouble\)/g, 'advanceTurn(true)');
code = code.replace(/advanceTurn\(false, diceValues \? diceValues\[0\] === diceValues\[1\] : false\)/g, 'advanceTurn(false)');
code = code.replace(/advanceTurn\(false, true\)/g, 'advanceTurn(false)');

// 2. Rewrite handleMoveCompletion to compute updatedTokens
const moveCompletionStart = code.indexOf('const handleMoveCompletion = (pId: number, tId: number, finalStep: number, moveIndices: number[]) => {');
const moveCompletionEnd = code.indexOf('};', moveCompletionStart) + 2;

const handleMoveBody = `const handleMoveCompletion = (pId: number, tId: number, finalStep: number, moveIndices: number[]) => {
    const movingToken = tokens.find((t) => t.playerId === pId && t.id === tId);
    if (!movingToken) {
      setIsAnimatingMove(false);
      advanceTurn(false);
      return;
    }

    let extraTurnGrant = false;
    let capturedOpponents: { playerId: number, id: number }[] = [];

    // 1. Goal Check
    if (finalStep === 57) {
      if (!isMuted) {
        audio.playGoal();
      }
      addLog(\`¡Ficha \${tId + 1} de \${activePlayer.name} entró a la meta final!\`, 'goal');

      const allReached = tokens
        .filter((t) => t.playerId === pId)
        .every((t) => (t.id === tId ? true : t.step === 57));

      if (allReached) {
        if (!isMuted) {
          audio.playVictory();
        }
        setWinner(pId);
        addLog(\`🎉🏆 ¡Felicidades! \${activePlayer.name} ha ganado la partida! 🏆🎉\`, 'system');
        setIsAnimatingMove(false);
        return;
      }
      extraTurnGrant = true;
    }

    // 2. Capture Check (only on normal perimeter cells)
    if (finalStep >= 1 && finalStep <= 51) {
      const pIndex = (START_OFFSETS[movingToken.color] + finalStep - 1) % 52;
      const isStartCell = [1, 14, 27, 40].includes(pIndex);
      const isGoldStar = [8, 21, 34, 47].includes(pIndex);
      
      const landingCoord = getCellCoord(movingToken.color, finalStep);

      const opponents = tokens.filter((t) => {
        if (t.playerId === pId || t.step === 0 || t.step === 57) return false;
        const otherCoord = getCellCoord(t.color, t.step);
        return otherCoord.row === landingCoord.row && otherCoord.col === landingCoord.col;
      });

      const shouldCapture = (!isGoldStar && !isStartCell);

      if (shouldCapture && opponents.length > 0) {
        if (!isMuted) {
          audio.playCapture();
        }

        capturedOpponents = opponents.map(o => ({ playerId: o.playerId, id: o.id }));

        setTokens((prev) =>
          prev.map((t) => {
            const isOpp = capturedOpponents.some((opp) => opp.playerId === t.playerId && opp.id === t.id);
            if (isOpp) return { ...t, step: 0 };
            return t;
          })
        );

        opponents.forEach((opp) => {
          const oppPlayer = players[opp.playerId];
          addLog(\`⚔️ ¡\${activePlayer.name} capturó la ficha \${opp.id + 1} de \${oppPlayer.name} y la mandó a la base!\`, 'capture');
        });

        extraTurnGrant = true;
      }
    }

    // Construct an up-to-date tokens array to check for remaining moves
    const updatedTokens = tokens.map(t => {
      if (t.playerId === pId && t.id === tId) {
        return { ...t, step: finalStep };
      }
      if (capturedOpponents.some(o => o.playerId === t.playerId && o.id === t.id)) {
        return { ...t, step: 0 };
      }
      return t;
    });

    setRemainingMoves(prev => {
      const newMoves = [...prev];
      [...moveIndices].sort((a, b) => b - a).forEach(idx => newMoves.splice(idx, 1));
      
      if (extraTurnGrant) {
        setIsAnimatingMove(false);
        advanceTurn(true);
        return [];
      } else if (newMoves.length === 0) {
        setIsAnimatingMove(false);
        advanceTurn(false);
        return [];
      } else {
        setIsAnimatingMove(false);
        const stillPlayable = getPlayableTokenIds(pId, newMoves, updatedTokens);
        if (stillPlayable.length === 0) {
          advanceTurn(false);
          return [];
        }
        return newMoves;
      }
    });
  };`;

code = code.substring(0, moveCompletionStart) + handleMoveBody + code.substring(moveCompletionEnd);

fs.writeFileSync('src/App.tsx', code);
