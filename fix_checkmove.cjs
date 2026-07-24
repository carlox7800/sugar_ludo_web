const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex3 = /\} else if \(token\.step > 0 && token\.step \+ moveVal <= 57\) \{\s*let blocked = false;\s*for \(let stepOffset = 1; stepOffset <= moveVal; stepOffset\+\+\) \{/;
const new3 = `} else if (token.step > 0 && token.step < 57) {
            let blocked = false;
            const distanceToGoal = 57 - token.step;
            const stepsToCheck = Math.min(moveVal, distanceToGoal);
            for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {`;

code = code.replace(regex3, new3);
fs.writeFileSync('src/App.tsx', code);
