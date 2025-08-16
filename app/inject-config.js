//
// This is a rough example, needs re-work.
//
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const TEMPLATE_PATH = path.join(__dirname, 'index.template.html');
const OUTPUT_PATH = path.join(__dirname, 'index.html');

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
    console.warn(`⚠️ Missing config key "${key}". Using fallback: "${requiredKeys[key]}"`);
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
console.log('✅ index.html generated with injected config.');