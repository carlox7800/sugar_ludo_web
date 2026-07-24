const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /if \(token\.step === 0\) \{\s*const idx = remainingMoves\.findIndex\(m => m === 5\);\s*if \(idx !== -1\) \{\s*moveToken\(tokenId, 5, \[idx\]\);\s*\}\s*\}/;

const newCode = `if (token.step === 0) {
        const idx = remainingMoves.findIndex(m => m === 5);
        if (idx !== -1) {
          moveToken(tokenId, 5, [idx]);
        } else if (remainingMoves.length === 2 && remainingMoves[0] + remainingMoves[1] === 5) {
          moveToken(tokenId, 5, [0, 1]);
        }
      }`;

if (regex.test(code)) {
  code = code.replace(regex, newCode);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Fixed handleTokenClick');
} else {
  console.log('Could not find regex');
}
