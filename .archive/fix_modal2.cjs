const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\{moveSelectorTokenId !== null && \([\s\S]*?<\/div>\s*\)\s*\}\s*<\/div>\s*\);\s*\}/;

const newModal = `{moveSelectorTokenId !== null && (() => {
        const tokenIndex = moveSelectorTokenId % 4;
        const playerIndex = Math.floor(moveSelectorTokenId / 4);
        const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex);
        if (!token) return null;

        const checkMoveValid = (moveVal: number) => {
          if (token.step === 0) {
            if (moveVal === 5) {
              const startIdx = START_OFFSETS[token.color];
              return !tokens.some(tk => tk.step > 0 && tk.step <= 51 && ((START_OFFSETS[tk.color] + tk.step - 1) % 52) === startIdx && tk.color === token.color);
            }
            return false;
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
            return !blocked;
          }
          return false;
        };

        const options: { label: string, val: number, indices: number[] }[] = [];
        
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
             options.push({ label: \`\${sum} (Suma)\`, val: sum, indices: [0, 1] });
           }
        }

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a24] border border-[#2d2d35] p-5 rounded-3xl shadow-2xl flex flex-col gap-4 max-w-[260px] w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-[#e0e0e0] font-black text-lg text-center font-mono uppercase tracking-wider">Mover</h3>
                <p className="text-[#888891] text-[11px] text-center leading-tight">¿Qué movimiento deseas aplicar a esta ficha?</p>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMoveSelectorTokenId(null);
                      moveToken(moveSelectorTokenId, opt.val, opt.indices);
                    }}
                    className="w-full py-2.5 bg-[#2d2d35] hover:bg-[#00f2ff]/10 hover:border-[#00f2ff] border border-[#2d2d35] rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  >
                    <span className="font-bold text-lg text-[#00f2ff] font-mono">{opt.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMoveSelectorTokenId(null)}
                className="mt-2 text-[#888891] hover:text-white text-[10px] font-bold tracking-widest uppercase transition-colors"
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

code = code.replace(regex, newModal);
fs.writeFileSync('src/App.tsx', code);
