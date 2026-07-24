const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. getPlayableTokenIds
const playableRegex = /if \(t\.step \+ m <= 57\) \{\s*let blocked = false;\s*for \(let stepOffset = 1; stepOffset <= m; stepOffset\+\+\) \{/;
const playableNew = `let blocked = false;
            const distanceToGoal = 57 - t.step;
            const stepsToCheck = Math.min(m, distanceToGoal);
            for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {`;
code = code.replace(playableRegex, playableNew);
// The closing brace for `if (t.step + m <= 57) {` was at the end. We need to remove one closing brace.
// Wait, replacing it with `let blocked = false;` removes the `if` opening.
// So we must remove the corresponding closing brace later.
// Let's use a smarter replace.
