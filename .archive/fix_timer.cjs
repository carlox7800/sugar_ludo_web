const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /if \(isPlaying && !winner && !isRolling && !isAnimatingMove\) \{/,
  `const shouldRunTimer = isPlaying && !winner && !isRolling && !isAnimatingMove && (!hasRolled || (hasRolled && playableTokenIds.length > 0));
    if (shouldRunTimer) {`
);

fs.writeFileSync('src/App.tsx', code);
