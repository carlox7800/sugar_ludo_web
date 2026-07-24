const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /if \(token\.step === 0\) \{[\s\S]*?\} else \{/;
const replacement = `if (token.step === 0) {
        const idx = remainingMoves.findIndex(m => m === 5);
        if (idx !== -1) {
          moveToken(tokenId, 5, [idx]);
        } else if (remainingMoves.length === 2 && remainingMoves[0] + remainingMoves[1] === 5) {
          moveToken(tokenId, 5, [0, 1]);
        }
      } else {`;
code = code.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', code);
