const fs = require('fs');
let code = fs.readFileSync('src/components/GameControls.tsx', 'utf8');

code = code.replace(
  /<div className="flex gap-4">[\s\S]*?\{!isRolling && hasRolled/,
  `<div className="flex justify-center items-center h-24 w-24">
              <div
                className={\`w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl border border-white/5 \${
                  isRolling ? 'animate-[spin_0.3s_linear_infinite]' : ''
                } \${isGlowActive ? 'ring-2 ring-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.4)]' : ''}\`}
                style={{
                  background: \`linear-gradient(135deg, \${COLOR_HEX[currentTurnPlayer.color]}, #050506)\`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {diceValue !== null ? (
                  renderDiceDots(diceValue, currentTurnPlayer.color)
                ) : (
                  <span className="text-white/60 font-bold text-xl font-mono">?</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-w-[200px]">
            {isHumanTurnToRoll ? (
              <>
                {!isRolling && hasRolled`
);

fs.writeFileSync('src/components/GameControls.tsx', code);
