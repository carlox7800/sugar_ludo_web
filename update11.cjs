const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const modalUI = `
      {moveSelectorTokenId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] border border-[#2d2d35] p-6 rounded-2xl shadow-2xl flex flex-col gap-4 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-[#e0e0e0] font-bold text-lg text-center font-mono">Selecciona un Movimiento</h3>
            <p className="text-[#888891] text-sm text-center">Tienes varias opciones de movimiento con esta ficha. ¿Qué dado deseas usar?</p>
            <div className="flex gap-4 justify-center">
              {remainingMoves.map((m, idx) => {
                const tokenIndex = moveSelectorTokenId % 4;
                const playerIndex = Math.floor(moveSelectorTokenId / 4);
                const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex);
                let isValid = false;
                if (token) {
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
                        const counts = {};
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
                }

                if (!isValid) return null;

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setMoveSelectorTokenId(null);
                      moveToken(moveSelectorTokenId, m, idx);
                    }}
                    className="w-16 h-16 bg-[#2d2d35] hover:bg-[#00f2ff]/20 hover:border-[#00f2ff] border border-[#2d2d35] rounded-xl flex items-center justify-center font-bold text-2xl cursor-pointer transition-all hover:scale-105"
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setMoveSelectorTokenId(null)}
              className="mt-2 text-[#888891] hover:text-white text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}`;

code = code.replace(/    <\/div>\s*\);\s*\}/, modalUI);
fs.writeFileSync('src/App.tsx', code);
