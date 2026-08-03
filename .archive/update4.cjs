const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const getPlayableTokenIds = \(pId: number, moves: number\[\]\): number\[\] => \{[\s\S]*?return playableIds;\s*\};/;

const newFunc = `const getPlayableTokenIds = (pId: number, moves: number[]): number[] => {
    if (moves.length === 0) return [];
    const hasFive = moves.includes(5);

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
    };

    playerTokens.forEach((t) => {
      const globalId = t.playerId * 4 + t.id;
      if (t.step === 0) {
        if (hasFive) {
          const startIdx = START_OFFSETS[t.color];
          if (!hasBarrierAt(startIdx)) {
            playableIds.push(globalId);
          }
        }
      } else if (t.step > 0 && t.step < 57) {
        // Can it move by ANY of the individual moves?
        let canMove = false;
        for (const m of moves) {
          if (t.step + m <= 57) {
            let blocked = false;
            for (let stepOffset = 1; stepOffset <= m; stepOffset++) {
              const pathStep = t.step + stepOffset;
              if (pathStep <= 51) {
                const pIndex = (START_OFFSETS[t.color] + pathStep - 1) % 52;
                if (hasBarrierAt(pIndex)) {
                  blocked = true;
                  break;
                }
              }
            }
            if (!blocked) {
              canMove = true;
              break;
            }
          }
        }
        if (canMove) {
          playableIds.push(globalId);
        }
      }
    });

    return playableIds;
  };`;

code = code.replace(regex, newFunc);
fs.writeFileSync('src/App.tsx', code);
