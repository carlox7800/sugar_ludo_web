const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix bot capture heuristic
const botRegex = /if \(nextStep >= 1 && nextStep <= 51 && !isGoldStar\) \{[\s\S]*?score \+= 500;\s*\}\s*\}/;
const newBotCapture = `if (nextStep >= 1 && nextStep <= 51 && !isGoldStar && !isStartCell) {
              const opponents = tokens.filter(
                (tk) => tk.playerId !== pId && tk.step > 0 && tk.step <= 51 &&
                ((START_OFFSETS[tk.color] + tk.step - 1) % 52) === pIndex
              );
              if (opponents.length > 0) {
                score += 500;
              }
            }`;
code = code.replace(botRegex, newBotCapture);

// Fix actual capture logic
const captureRegex = /const shouldCapture = \(!isGoldStar && !isStartCell\) \|\| \(isStartCell && opponents\.length > 0\);/;
const newCapture = `const shouldCapture = (!isGoldStar && !isStartCell);`;
code = code.replace(captureRegex, newCapture);

// Fix modal
const modalRegex = /const options: \{ label: string, val: number, indices: number\[\] \}\[\] = \[\];[\s\S]*?\}\)\(\)\}\s*<\/div>\s*\);\s*\}/;
const newModal = `const options: { label: string, val: number, indices: number[] }[] = [];
        
        const seenValues = new Set<number>();
        remainingMoves.forEach((m, idx) => {
          if (!seenValues.has(m)) {
            if (checkMoveValid(m)) {
              options.push({ label: m.toString(), val: m, indices: [idx] });
              seenValues.add(m);
            }
          }
        });

        if (remainingMoves.length === 2 && token.step > 0) {
           const sum = remainingMoves[0] + remainingMoves[1];
           if (checkMoveValid(sum)) {
             options.push({ label: sum.toString(), val: sum, indices: [0, 1] });
           }
        }

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a24] border border-[#2d2d35] p-4 rounded-2xl shadow-2xl flex flex-col gap-3 max-w-[200px] w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-[#e0e0e0] font-black text-base text-center font-mono uppercase tracking-wider">Mover</h3>
              </div>
              <div className="flex flex-row flex-wrap justify-center gap-2 mt-1">
                {options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMoveSelectorTokenId(null);
                      moveToken(moveSelectorTokenId, opt.val, opt.indices);
                    }}
                    className="w-14 h-14 bg-[#2d2d35] hover:bg-[#00f2ff]/10 hover:border-[#00f2ff] border border-[#2d2d35] rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  >
                    <span className="font-bold text-lg text-[#00f2ff] font-mono">{opt.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMoveSelectorTokenId(null)}
                className="mt-1 text-[#888891] hover:text-white text-[10px] font-bold tracking-widest uppercase transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}`;
code = code.replace(modalRegex, newModal);

fs.writeFileSync('src/App.tsx', code);
