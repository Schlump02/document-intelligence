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
function containsQuotes(str){
    return str.includes('"') || str.includes("„") || str.includes("“")
}

/**
 * removes empty spaces, punctuation marks and similar unwanted strings. Treats quotation marks as separate words.
 */
function getSanitizedWords(rawStr){
    rawStr = rawStr.replace('"', ' " ').replace('„', ' „ ').replace('“', ' “ ');
    
    const unwantedWords = ["", ",", ".", ";", ":", "-", "_", "|", "!", "?", "'",
                            "\"", "/", "\\", "(", ")", "[", "]", "{", "}", "<",
                            ">", "*", "&", "#", "@", "%", "^", "=", "+", "~",
                            "•", "$", "€", "–", "[]", "[.]", "[..]", "[...]"
                        ];
    const rawWords = rawStr.split(" ");
    let words = [];
    
    for(let word of rawWords){
        word = word.trim();
        if(!unwantedWords.includes(word)){
            words.push(word);
        }
    }
    return words;
}


async function countWords(src) {
    const doc = await pdfjs.getDocument(src).promise;
    let wordCounts = [];
    let headline = "";
    let currentCounts = {"text": 0, "quotes": 0, "footnotes": 0};
    let currentWords = {"text": "", "quotes": "", "footnotes": ""};
    
    let firstSectionFound = false;
    let insideQuote = false;
    
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
                    wordCounts.push({"headline": prevHeadline, "counts": currentCounts, "words": currentWords})
                    
                    if(isChapterAfterLastSection(headline)){
                        return wordCounts;// iterated through all sections, finish counting
                    }
                    // otherwise, re-initialize values
                    currentCounts= {"text": 0, "quotes": 0, "footnotes": 0};
                    currentWords = {"text": "", "quotes": "", "footnotes": ""};
                    insideQuote = false;
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
            
            let words = getSanitizedWords(item["str"]);
            
            if(fontsize === 10 && x === 83){
                // footnotes
                currentWords["footnotes"] += " " + item["str"];
                currentCounts["footnotes"] += words.length;
            }
            else if(fontsize === 12){
                // words within text
                if(!containsQuotes(item["str"])){
                    if(!insideQuote){
                        // no quote shenanigans
                        currentWords["text"] += " " + words.join(" ");
                        currentCounts["text"] += words.length;
                    }
                    else{
                        // only words in quotes
                        currentWords["quotes"] += " " + words.join(" ");
                        currentCounts["quotes"] += words.length;
                    }
                }
                else{
                    // quote shenanigans
                    for(let word of words){
                        containsQuotes(word);
                    }
                }
            }
        }
    }
    return wordCounts;
}


const pdfPath = '../../benchmark/main.pdf';
//console.log(countWords(pdfPath));
const output = await countWords(pdfPath);
console.log(output);

// Close the stream when done
stream.end();