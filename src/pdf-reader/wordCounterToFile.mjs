import countWords from "./wordCounter.mjs";
import fs from 'fs';
import path from 'path';

// Define the file path where you want to save the console output
const filePath = path.join('.', 'console_output.json');

// Create a writable stream to the file
const clearStream = fs.createWriteStream(filePath, { flags: 'w' }); // 'w' flag clears the file
clearStream.end();

const stream = fs.createWriteStream(filePath, { flags: 'a' }); // 'a' flag appends to the file

// Redirect console output to the writable stream
console.log = function(...args) {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(' ');
    stream.write(message + '\n');
};

const pdfPath = '../../benchmark/main.pdf';
//const pdfPath = 'fixed.pdf';

const output = await countWords(pdfPath);
console.log(output);

// Close the stream when done
stream.end();