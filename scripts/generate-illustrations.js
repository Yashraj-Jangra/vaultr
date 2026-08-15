const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../public/illustrations');
const destFile = path.join(__dirname, '../mobile/src/components/illustrationData.ts');

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.svg'));

let output = 'export const ILLUSTRATION_DATA: Record<string, string> = {';

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const name = file.replace('.svg', '');
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  // Escape quotes and backslashes for string literal
  const escapedContent = content
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
    
  output += `"${name}":"${escapedContent}"`;
  if (i < files.length - 1) {
    output += ',';
  }
}

output += '};\n';

fs.writeFileSync(destFile, output);
console.log('Successfully generated illustrationData.ts with ' + files.length + ' SVGs.');
