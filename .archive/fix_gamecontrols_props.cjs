const fs = require('fs');
let code = fs.readFileSync('src/components/GameControls.tsx', 'utf8');
code = code.replace(
  /isGlowActive,\n\}\) => \{/,
  'isGlowActive,\n  appTheme,\n  setAppTheme,\n}) => {'
);
fs.writeFileSync('src/components/GameControls.tsx', code);
