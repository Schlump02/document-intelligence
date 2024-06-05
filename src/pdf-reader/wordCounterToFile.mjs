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
//const pdfPath = 'broken.pdf';
//const pdfPath = 'fixed.pdf';
//const pdfPath = '../../../bachelor-thesis/main.pdf';

const output = await countWords(pdfPath);
console.log("\n\nOutput:", output);

let counters = {"text": 0, "quotes": 0, "footnotes": 0, "descriptions": 0};
for(let section of output["wordCounts"]){
    counters["text"] += section["counts"]["text"];
    counters["quotes"] += section["counts"]["quotes"];
    counters["footnotes"] += section["counts"]["footnotes"];
    counters["descriptions"] += section["counts"]["descriptions"];
}
console.log("\n\nWörter Gesamt:", counters);


// Close the stream when done
stream.end();