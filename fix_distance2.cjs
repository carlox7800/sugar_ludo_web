const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex1 = /if \(t\.step \+ m <= 57\) \{\s*let blocked = false;\s*for \(let stepOffset = 1; stepOffset <= m; stepOffset\+\+\) \{/;
const new1 = `          // Removed if(t.step+m<=57)
            let blocked = false;
            const distanceToGoal = 57 - t.step;
            const stepsToCheck = Math.min(m, distanceToGoal);
            for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {`;

code = code.replace(regex1, new1);
// Now we need to remove the matching `}` for the `if (t.step + m <= 57)` in `getPlayableTokenIds`
code = code.replace(/if \(!blocked\) \{\s*canMove = true;\s*break;\s*\}\s*\}/, `if (!blocked) {
              canMove = true;
              break;
            }`);

fs.writeFileSync('src/App.tsx', code);
