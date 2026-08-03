const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

const regex = /\{\/\* Token Main Body Ring \*\/\}\s*<circle\s*cx=\{0\}\s*cy=\{0\}\s*r=\{16\}\s*fill=\{`url\(#token-\$\{token\.color\}-grad\)`\}\s*stroke="#1F2937"\s*strokeWidth="2"\s*filter="drop-shadow\(0px 2px 3px rgba\(0,0,0,0\.4\)\)"\s*\/>\s*\{\/\* Inside Glossy Detail \/ Concentric ring \*\/\}\s*<circle\s*cx=\{-3\}\s*cy=\{-3\}\s*r=\{6\}\s*fill="#FFFFFF"\s*opacity="0\.25"\s*\/>\s*<circle\s*cx=\{0\}\s*cy=\{0\}\s*r=\{9\}\s*fill="none"\s*stroke="#FFFFFF"\s*strokeWidth="1\.5"\s*opacity="0\.8"\s*\/>/m;

const newSVG = `{appTheme === 'sugar' ? (
                <>
                  <path d="M -15 0 L -24 -10 L -24 10 Z" fill={COLOR_HEX[token.color]} opacity="0.9" />
                  <path d="M 15 0 L 24 -10 L 24 10 Z" fill={COLOR_HEX[token.color]} opacity="0.9" />
                  <circle cx={0} cy={0} r={16} fill={COLOR_HEX[token.color]} stroke="rgba(255,255,255,0.9)" strokeWidth="3" filter="drop-shadow(0px 3px 4px var(--shadow-color))" />
                  <circle cx={0} cy={0} r={8} fill="rgba(255,255,255,0.45)" />
                  <circle cx={-4} cy={-4} r={3} fill="rgba(255,255,255,0.8)" />
                </>
              ) : (
                <>
                  <circle cx={0} cy={0} r={16} fill={\`url(#token-\${token.color}-grad)\`} stroke="var(--color-border)" strokeWidth="2" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" />
                  <circle cx={0} cy={0} r={10} fill="var(--bg-panel)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
                  <circle cx={0} cy={0} r={5} fill={\`url(#token-\${token.color}-grad)\`} />
                  <circle cx={-5} cy={-5} r={2.5} fill="rgba(255, 255, 255, 0.8)" />
                </>
              )}`;

if (regex.test(code)) {
  code = code.replace(regex, newSVG);
  fs.writeFileSync('src/components/GameBoard.tsx', code);
  console.log('Fixed SVG');
} else {
  console.log('Regex not found');
}
