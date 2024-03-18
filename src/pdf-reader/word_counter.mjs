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

function isChapterAfterLastSection(headline){
    const endingChapters = ["Anhang", "Literaturverzeichnis", "Ehrenwörtliche", "Eidesstattliche"];
    const headlineWords = headline.split(" ");
    for(let word of headlineWords){
        if(endingChapters.includes(word)){ return true; }
    }
    return false;
}


async function countWords(src) {
    const doc = await pdfjs.getDocument(src).promise;
    let wordCounts = [];
    let headline = "";
    let currentCounts = {"text": 0, "quotes": 0, "footnotes": 0};
    //let flags = {""}
    let firstSectionFound = false;
    
    
    for(let i = 1; i <= doc.numPages; i++){
        const pageContent = await doc.getPage(i).then(page => page.getTextContent());
        
        for(let item of pageContent.items){
            //console.log(item);
            let fontsize = Math.round(item["height"]);
            let x = Math.round(item["transform"][4]);
            let y = Math.round(item["transform"][5]);
            
            if(fontsize === 14){
                // new headline found
                let prevHeadline = headline;
                headline = item["str"];
                
                if(firstSectionFound){
                    // save word counts
                    wordCounts.push({"headline": prevHeadline, "counts": currentCounts})
                
                    if(isChapterAfterLastSection(headline)){
                        return wordCounts;// iterated through all sections, finish counting
                    }
                    // otherwise, re-initialize values
                    currentCounts= {"text": 0, "quotes": 0, "footnotes": 0};
                }
                else if(headline.startsWith("1 ")){
                    firstSectionFound = true;// first section found, start counting with the next string
                    continue;
                }
            }
            
            // skip word counting?
            if(!firstSectionFound           // don't count words outside of sections
                || item["str"].length < 1   // no words to count
                || y < 60)                  // only page numbers are placed this low
            { continue; }
            
            else if(fontsize === 10 && x === 83){
                //currentCounts["footnotes"] += item["str"].split(" ");
                currentCounts["footnotes"] += item["str"].split(" ").length;
            }
            else if(fontsize === 12){
                //currentCounts["text"] += item["str"].split(" ");
                currentCounts["text"] += item["str"].split(" ").length;
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