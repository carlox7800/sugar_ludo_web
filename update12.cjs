const fs = require('fs');
let code = fs.readFileSync('src/components/GameControls.tsx', 'utf8');

code = code.replace(
  /diceValues: \[number, number\] \| null;/,
  `diceValues: [number, number] | null;
  remainingMoves: number[];`
);

code = code.replace(
  /diceValues,\s*isRolling,/,
  `diceValues,
  remainingMoves,
  isRolling,`
);

code = code.replace(
  /\{\[0, 1\]\.map\(\(dieIdx\) => \(/,
  `{[0, 1].map((dieIdx) => {
                const hasBeenUsed = diceValues !== null && !remainingMoves.includes(diceValues[dieIdx]);
                // Wait, if roll was [5, 5] and remaining is [5], we need to know which one was used.
                // It's safer to count occurrences.
                let isUsed = false;
                if (diceValues) {
                   const rolledCount = diceValues.filter((v, i) => v === diceValues[dieIdx] && i <= dieIdx).length;
                   const remainingCount = remainingMoves.filter(v => v === diceValues[dieIdx]).length;
                   // If rolledCount > remainingCount, this specific instance is used.
                   // Example: roll [5, 5]. dieIdx 0 -> rolledCount 1. remaining [5] -> remainingCount 1. 1 > 1 false.
                   // dieIdx 1 -> rolledCount 2. remaining [5] -> remainingCount 1. 2 > 1 true. -> used!
                   isUsed = rolledCount > remainingCount;
                }
                
                return (`
);

code = code.replace(
  /className={\`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative \$\{/,
  `className={\`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative \${isUsed ? 'opacity-30 grayscale scale-90' : ''} \${`
);

code = code.replace(
  /\{\s*diceValues !== null \? \(\s*renderDiceDots\(diceValues\[dieIdx\], currentTurnPlayer\.color\)\s*\) : \(/,
  `{ diceValues !== null ? (
                    renderDiceDots(diceValues[dieIdx], currentTurnPlayer.color)
                  ) : (`
);

code = code.replace(
  /<\/span>\s*\)\}\s*<\/div>\s*\)\)\}/,
  `</span>
                  )}
                </div>
              );
            })}`
);


fs.writeFileSync('src/components/GameControls.tsx', code);
