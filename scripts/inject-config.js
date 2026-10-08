// Fills a page template with the values from a view's config.json.
// Usage: node scripts/inject-config.js <config.json> <template.html> <output.html>
//
// Every {{KEY}} in the template is replaced by the value of KEY in the config. Used only by
// scripts/build-sites.sh, which checks that no {{INJECT_*}} placeholder is left over.
const fs = require('fs');

const [configPath, templatePath, outputPath] = process.argv.slice(2);
if (!configPath || !templatePath || !outputPath) {
  console.error('Usage: node scripts/inject-config.js <config.json> <template.html> <output.html>');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let html = fs.readFileSync(templatePath, 'utf8');
for (const [key, value] of Object.entries(config)) {
  html = html.split(`{{${key}}}`).join(value);
}
fs.writeFileSync(outputPath, html);
