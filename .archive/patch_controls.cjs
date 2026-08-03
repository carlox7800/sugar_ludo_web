const fs = require('fs');
let code = fs.readFileSync('src/components/GameControls.tsx', 'utf8');

code = code.replace(/diceValue: number \| null;/g, 'diceValues: [number, number] | null;');
code = code.replace(/diceValue,/g, 'diceValues,');

code = code.replace(
  /<div className="flex justify-center w-full my-4">[\s\S]*?\{!hasRolled && !isRolling \? \(/,
  `<div className="flex gap-3">
              {[0, 1].map((dieIdx) => (
                <div
                  key={dieIdx}
                  onClick={() => isHumanTurnToRoll && !isRolling && !hasRolled && onRollDice()}
                  className={\`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative \${
                    isHumanTurnToRoll && !isRolling && !hasRolled
                      ? 'cursor-pointer hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,242,255,0.15)] border border-[#2d2d35]'
                      : 'shadow-md border border-[#2d2d35]'
                  } \${isRolling ? 'animate-spin' : ''} \${bgColors[currentTurnPlayer.color]} \${
                    isGlowActive ? 'ring-4 ring-[#00f2ff] ring-offset-2 ring-offset-[#050506]' : ''
                  }\`}
                >
                  {diceValues !== null ? (
                    renderDiceDots(diceValues[dieIdx], currentTurnPlayer.color)
                  ) : (
                    <span className="text-white/60 font-bold text-xl font-mono">?</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-w-[200px]">
            {isHumanTurnToRoll ? (
              <>
                {!hasRolled && !isRolling ? (`
);

fs.writeFileSync('src/components/GameControls.tsx', code);
