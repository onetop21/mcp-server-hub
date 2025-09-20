// Simple Node.js test without dependencies
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);

// Test basic JavaScript functionality
const testEnum = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise'
};

console.log('Test enum:', testEnum);
console.log('Test successful!');

// Test if we can require basic modules
try {
  const fs = require('fs');
  const path = require('path');
  
  console.log('Basic modules work');
  
  // Check if our source files exist
  if (fs.existsSync('src')) {
    console.log('Source directory exists');
    const srcFiles = fs.readdirSync('src');
    console.log('Source files:', srcFiles);
  }
  
  if (fs.existsSync('dist')) {
    console.log('Dist directory exists');
    const distFiles = fs.readdirSync('dist');
    console.log('Dist files:', distFiles);
  }
  
} catch (error) {
  console.error('Error:', error.message);
}