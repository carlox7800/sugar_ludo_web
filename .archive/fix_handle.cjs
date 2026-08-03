const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const handleTokenClick = \(tokenId: number\) => \{[\s\S]*?if \(validMoveIndices\.length === 0\) return;\s*if \(validMoveIndices\.length === 1 \|\| \(token\.step === 0 && new Set\(validMoveIndices\.map\(i => remainingMoves\[i\]\)\)\.size === 1\)\) \{\s*const idx = validMoveIndices\[0\];\s*moveToken\(tokenId, remainingMoves\[idx\], \[idx\]\);\s*\} else \{\s*setMoveSelectorTokenId\(tokenId\);\s*\}\s*\}\s*\};/;

const newFunc = `const handleTokenClick = (tokenId: number) => {
    if (activePlayer.type !== 'human' || isAnimatingMove || isRolling || !hasRolled) return;

    if (playableTokenIds.includes(tokenId)) {
      const tokenIndex = tokenId % 4;
      const playerIndex = Math.floor(tokenId / 4);
      const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex);
      if (!token) return;

      if (token.step === 0) {
        const idx = remainingMoves.findIndex(m => m === 5);
        if (idx !== -1) {
          moveToken(tokenId, 5, [idx]);
        }
      } else {
        if (remainingMoves.length === 1) {
          moveToken(tokenId, remainingMoves[0], [0]);
        } else {
          setMoveSelectorTokenId(tokenId);
        }
      }
    }
  };`;

code = code.replace(regex, newFunc);
fs.writeFileSync('src/App.tsx', code);
