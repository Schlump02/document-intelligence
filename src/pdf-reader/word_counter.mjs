import * as pdfjs from "pdfjs-dist";
import fs from 'fs';
import path from 'path';

// Define the file path where you want to save the console output
const filePath = path.join('.', 'console_output.json');

// Create a writable stream to the file
const stream = fs.createWriteStream(filePath, { flags: 'a' }); // 'a' flag appends to the file

// Redirect console output to the writable stream
console.log = function(...args) {
    const message = args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(' ');
    stream.write(message + '\n');
};


async function countWords(src) {
    const doc = await pdfjs.getDocument(src).promise;
    let wordCounts = [];
    let headline = "";
    let currentCounts = {"text": 0, "quotes": 0, "footnotes": 0};
    //let flags = {""}
    let firstHeadlineFound = false;
    
    for(var i = 1; i <= doc.numPages; i++){
        const pageContent = await doc.getPage(i).then(page => page.getTextContent());
        
        for(let item of pageContent.items){
            //console.log(item);
            let fontsize = Math.round(item["height"]);
            let x = Math.round(item["transform"][4]);
            let y = Math.round(item["transform"][5]);
            // look for headline
            if(fontsize === 14){
                wordCounts.push({"headline": headline, "counts": currentCounts})
                headline = "";
                currentCounts= {"text": 0, "quotes": 0, "footnotes": 0};
                
                firstHeadlineFound = true;
                headline += item["str"];
            }
            
            // skip word counting
            if(!firstHeadlineFound          // 
                || item["str"].length < 1   // no words to count
                || y < 60)                  // only page numbers are placed this low
            { continue; }
            
            else if(fontsize === 10 && x === 83){
                currentCounts["footnotes"] += item["str"].split(" ");
            }
            else if(fontsize === 12){
                currentCounts["text"] += item["str"].split(" ");
            }
        }
    }
    return wordCounts;
}


const pdfPath = 'C:/Users/Jona/Repositories/document-intelligence/benchmark/main.pdf';
//console.log(countWords(pdfPath));
const output = await countWords(pdfPath);
console.log(output);

// Close the stream when done
stream.end();