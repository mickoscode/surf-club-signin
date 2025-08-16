// Script to inject values from config.json into a template HTML file
// Usage: node inject-config.js [filenameStub]
//
// This script must be eecuted from within same directory as templates and config.json IF using symbolic links!

const fs = require('fs');
const path = require('path');

let filenameStub = 'index';
if (process.argv.length === 3) {
  filenameStub = process.argv[2];
}

// using cwd instead of __dirname so that I can use symbolic links for the script and template file
//const CONFIG_PATH = path.join(__dirname, 'config.json');
//const TEMPLATE_PATH = path.join(__dirname, 'index.template.html');
//const OUTPUT_PATH = path.join(__dirname, 'index.html');
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const TEMPLATE_PATH = path.join(process.cwd(), `${filenameStub}.template.html`);
const OUTPUT_PATH = path.join(process.cwd(), `${filenameStub}.html`);

// Define required keys and fallback values
// Not using these - values need to be in config.json to prevent error!!
const requiredKeys = {
  NOT_IN_USE_API_URL: 'https://example.com/api'
};

// Load config
let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  console.warn('⚠️ config.json not found or invalid. Using fallback values.');
}

// Validate and apply fallbacks
for (const key of Object.keys(requiredKeys)) {
  if (!config[key]) {
    // not using this for now
    //console.warn(`⚠️ Missing config key "${key}". Using fallback: "${requiredKeys[key]}"`);
    config[key] = requiredKeys[key];
  }
}

// Load template
let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// Inject values
Object.entries(config).forEach(([key, value]) => {
  const pattern = new RegExp(`{{${key}}}`, 'g');
  html = html.replace(pattern, value);
});

// Write output
fs.writeFileSync(OUTPUT_PATH, html);
console.log(`✅ ${filenameStub}.html generated with injected config.`);