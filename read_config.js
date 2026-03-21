const fs = require('fs');
const str = fs.readFileSync('firebase-config.json', 'utf16le');
console.log(str);
