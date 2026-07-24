const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const getBestBotMove = \([\s\S]*?return bestTokenId;\s*\};/;

const newFunc = `const getBestBotMove = (pId: number, moves: number[], playableIds: number[]): { tokenId: number, moveIndex: number, moveVal: number } | null => {
    if (playableIds.length === 0 || moves.length === 0) return null;

    const difficulty = config?.botDifficulty || 'medium';
    let bestMove: { tokenId: number, moveIndex: number, moveVal: number } | null = null;
    let highestScore = -Infinity;

    playableIds.forEach((globalId) => {
      const tokenIndex = globalId % 4;
      const token = tokens.find((t) => t.playerId === pId && t.id === tokenIndex);
      if (!token) return;

      moves.forEach((moveVal, moveIndex) => {
        let isValid = false;
        if (token.step === 0) {
          if (moveVal === 5) {
            const startIdx = START_OFFSETS[token.color];
            isValid = !tokens.some(tk => {
              if (tk.step > 0 && tk.step <= 51) {
                const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
                return tkIdx === startIdx && tk.color === token.color; // simplified barrier check
              }
              return false;
            });
          }
        } else if (token.step > 0 && token.step + moveVal <= 57) {
          let blocked = false;
          for (let stepOffset = 1; stepOffset <= moveVal; stepOffset++) {
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

        if (isValid) {
          if (difficulty === 'easy') {
            // we just give a random score to each valid move
            const score = Math.random();
            if (score > highestScore) {
              highestScore = score;
              bestMove = { tokenId: globalId, moveIndex, moveVal };
            }
          } else {
            let score = 0;
            const currentStep = token.step;
            let nextStep = currentStep === 0 ? 1 : currentStep + moveVal;

            if (currentStep === 0) score += 1000;
            if (nextStep === 57) score += 300;
            score += currentStep * 5;

            const pIndex = (START_OFFSETS[token.color] + nextStep - 1) % 52;
            const isStartCell = [1, 14, 27, 40].includes(pIndex);
            const isGoldStar = [8, 21, 34, 47].includes(pIndex);
            
            if (nextStep >= 1 && nextStep <= 51 && !isGoldStar) {
              const opponents = tokens.filter(
                (tk) => tk.playerId !== pId && tk.step > 0 && tk.step <= 51 &&
                ((START_OFFSETS[tk.color] + tk.step - 1) % 52) === pIndex
              );
              const shouldCapture = !isStartCell || (isStartCell && opponents.length > 0);
              if (shouldCapture && opponents.length > 0) {
                score += 500;
              }
            }

            if (difficulty === 'medium') {
              score += Math.random() * 40;
            }

            if (score > highestScore) {
              highestScore = score;
              bestMove = { tokenId: globalId, moveIndex, moveVal };
            }
          }
        }
      });
    });

    return bestMove;
  };`;

code = code.replace(regex, newFunc);
fs.writeFileSync('src/App.tsx', code);
