const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Update getPlayableTokenIds to take currentTokens
const oldGetPlayable = `  const getPlayableTokenIds = (pId: number, moves: number[]): number[] => {
    if (moves.length === 0) return [];
    const hasFive = moves.includes(5);
    const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5;

    const playerTokens = tokens.filter((t) => t.playerId === pId);
    const playableIds: number[] = [];

    const hasBarrierAt = (perimeterIndex: number) => {
      if (perimeterIndex < 0 || perimeterIndex > 51) return false;
      const counts: Record<string, number> = {};
      tokens.forEach(tk => {
        if (tk.step > 0 && tk.step <= 51) {
          const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
          if (tkIdx === perimeterIndex) {
            counts[tk.color] = (counts[tk.color] || 0) + 1;
          }
        }
      });
      return Object.values(counts).some(count => count >= 2);
    };`;

const newGetPlayable = `  const getPlayableTokenIds = (pId: number, moves: number[], currentTokens = tokens): number[] => {
    if (moves.length === 0) return [];
    const hasFive = moves.includes(5);
    const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5;

    const playerTokens = currentTokens.filter((t) => t.playerId === pId);
    const playableIds: number[] = [];

    const hasBarrierAt = (perimeterIndex: number) => {
      if (perimeterIndex < 0 || perimeterIndex > 51) return false;
      const counts: Record<string, number> = {};
      currentTokens.forEach(tk => {
        if (tk.step > 0 && tk.step <= 51) {
          const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
          if (tkIdx === perimeterIndex) {
            counts[tk.color] = (counts[tk.color] || 0) + 1;
          }
        }
      });
      return Object.values(counts).some(count => count >= 2);
    };`;
code = code.replace(oldGetPlayable, newGetPlayable);

// Remove 'isDouble' parameter from advanceTurn and simplify it
const advanceTurnRegex = /const advanceTurn = \([\s\S]*?\/\/ Proceed to next player\s*moveToNextPlayer\(\);\s*\}/;
const newAdvanceTurn = `const advanceTurn = (extraTurn: boolean) => {
    setDiceValues(null);
    setHasRolled(false);
    setTimer(10);
    setConsecutiveSixes(0);

    if (winner !== null) return;

    if (extraTurn) {
      addLog(\`¡\${activePlayer.name} obtiene tiro adicional por su captura o llegada a meta!\`, 'system');
      triggerTurnStart();
    } else {
      moveToNextPlayer();
    }
  }`;
code = code.replace(advanceTurnRegex, newAdvanceTurn);

// Update calls to advanceTurn
code = code.replace(/advanceTurn\(false, isDouble\)/g, 'advanceTurn(false)');
code = code.replace(/advanceTurn\(true, isDouble\)/g, 'advanceTurn(true)');
code = code.replace(/advanceTurn\(false, diceValues \? diceValues\[0\] === diceValues\[1\] : false\)/g, 'advanceTurn(false)');
code = code.replace(/advanceTurn\(false, true\)/g, 'advanceTurn(false)');

fs.writeFileSync('src/App.tsx', code);
