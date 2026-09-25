const fs = require('fs');
const { translations } = require('./i18n.js');

const html = fs.readFileSync('index.html', 'utf8');
const known = new Set([...Object.values(translations.zh), ...Object.values(translations.en)]);
const texts = [...html.matchAll(/>([^<>]+)</g)].map(match => match[1].trim()).filter(Boolean);
const attributes = [...html.matchAll(/(?:placeholder|aria-label|title)="([^"]+)"/g)]
  .map(match => match[1].trim());
const missing = [...new Set([...texts, ...attributes])]
  .filter(value => /[一-龥]/.test(value) && !known.has(value));

console.log(`Missing static translations: ${missing.length}`);
missing.forEach(value => console.log(JSON.stringify(value)));
