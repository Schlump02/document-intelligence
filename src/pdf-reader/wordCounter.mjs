import * as pdfjs from "pdfjs-dist";

function initializeStateVars(){
    return [{"text": 0, "quotes": 0, "footnotes": 0}, {"text": [], "quotes": [], "footnotes": []}, false]
}

function isChapterAfterLastSection(headline){
    const endingChapters = ["Anhang", "Literaturverzeichnis", "Ehrenwörtliche", "Eidesstattliche"];
    const headlineWords = headline.split(" ");
    for(let word of headlineWords){
        if(endingChapters.includes(word)){ return true; }
    }
    return false;
}

/**
 * returns the possible ways for the next subsection numbering
 * e.g. 1.2.3 -> [1.2.3.1, 1.2.4, 1.3]
 */
function getPlausibleNumbering(subHeadline){
    // get the numbering of the headline
    const numbering = subHeadline.split(" ")[0];
    const numbers = numbering.split(".");
    let num = "";
    
    // a new subsection is always possible
    const plausibleNumbering = [numbering + ".1"];
    
    // find all ways that this section or higher order sections might continue
    for(let i = 2; i <= numbers.length; i++){
        num = numbers.slice(0, i-1).join('.') + "." + (parseInt(numbers[i-1]) + 1);
        plausibleNumbering.push(num);
    }
    return plausibleNumbering;
}

function isSubsectionHeading(item, currentSubHeadline, defaultFontName){
    // headlines must start with a number and contain a space, they also use a different font
    if(isNaN(currentSubHeadline[0])
        || !currentSubHeadline.includes(" ")
        || item["fontName"] == defaultFontName)
    { return false; }
    
    let plausibleNumbering = getPlausibleNumbering(currentSubHeadline);
    
    // new headline must start with a plausible numbering 
    return plausibleNumbering.includes(item["str"].split(" ")[0])
}

/**
 * removes empty spaces, punctuation marks and similar unwanted strings. Treats certain special characters as separate words.
 */
function getSanitizedWords(rawStr){
    const charsAsWords = ['"', '„', '“', "f\\.", "–", "\\.", "/"]
    // treat these characters as words, making it easier to filter them out later
    for(let char of charsAsWords){
        rawStr = rawStr.replace(new RegExp(char, "g"), ' ' + char + ' ')
    }
    
    const unwantedWords = ["", ",", ".", ";", ":", "-", "_", "|", "!", "?", "'", "²",
                            "`", "/", "\\", "(", ")", "[", "]", "{", "}", "<", "³",
                            "•", "$", "€", "[sic]", "[sic!]", "(!)", "[!]", "\\.",
                            ">", "*", "&", "#", "@", "%", "^", "=", "+", "~"
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

function containsQuotes(str){
    return str.includes('"') || str.includes("„") || str.includes("“")
}

function removeQuotationMarks(words){
    const marks = ['"', '„', '“'];
    return words.filter(element => !marks.includes(element));
}


export default async function countWords(src) {
    const doc = await pdfjs.getDocument(src).promise;
    
    let footnoteHeadlines = [];
    let footnoteCount = 0;
    
    let [currentCounts, currentWords, insideQuote] = initializeStateVars();
    
    let [wordCounts, warnings, ignoredWords] = [[], [], []];
    let [headline, subHeadline, defaultFontName] = ["", "", ""];
    let [firstSectionFound, itemShouldStartANewLine, searchingForNewLine] = [false, false, false];
    
    for(let i = 1; i <= doc.numPages; i++){
        const pageContent = await doc.getPage(i).then(page => page.getTextContent());
        
        for(let item of pageContent.items){
            let fontsize = Math.round(item["height"]);
            let x = Math.round(item["transform"][4]);
            let y = Math.round(item["transform"][5]);
            
            if(fontsize === 14){
                // new section headline found
                let prevHeadline = subHeadline;
                headline = item["str"];
                subHeadline = headline;
                
                if(firstSectionFound){
                    // save word counts
                    wordCounts.push({"headline": prevHeadline, "counts": currentCounts, "words": currentWords});
                    
                    if(isChapterAfterLastSection(headline)){
                        // iterated through all sections, finish counting
                        warnings.push("Word count stopped after reaching headline: " + headline);
                        return {"wordCounts": wordCounts, "warnings": warnings, "ignoredWords": ignoredWords};
                    }
                    // otherwise, re-initialize values
                    [currentCounts, currentWords, insideQuote] = initializeStateVars();
                }
                else if(headline.startsWith("1 ")){
                    firstSectionFound = true;// first section found, start counting with the next string
                    itemShouldStartANewLine = item["hasEOL"];
                    continue;
                }
            }
            
            // skip word counting?
            if(!firstSectionFound           // don't count words outside of sections
                || item["str"].length < 1   // no words to count
                || y < 60){                 // only page numbers are placed this low
                
                itemShouldStartANewLine = item["hasEOL"];
                continue;
            }
            
            else if(fontsize === 7 || fontsize === 8){
                // likely a footnotemark - do not count as word, but make sure
                // the footnote words will counted for the correct headline
                let markNum = parseInt(item["str"]);
                // check if the mark isn't placed at the page bottom
                // and that the mark contains next expected number
                if(x !== 76 && markNum && markNum == footnoteCount + 1){
                    footnoteHeadlines.push(subHeadline);
                    footnoteCount += 1
                }
            }
            
            // sanitize words before counting
            let words = getSanitizedWords(item["str"]);
            if(!words || !words.length){
                // no words to count
                itemShouldStartANewLine = item["hasEOL"];
                continue;
            }
            
            if(fontsize === 10 && x === 83){
                // words in footnotes
                words = removeQuotationMarks(words);
                // make sure to assign the words and word counts to the correct headline
                let correspondingHeadline = footnoteHeadlines.shift();
                if(subHeadline === correspondingHeadline){
                    currentWords["footnotes"].push(...words);
                    currentCounts["footnotes"] += words.length;
                }
                else{
                    let wordCountElement = wordCounts.find(item => item.headline === correspondingHeadline);
                    wordCountElement["words"]["footnotes"].push(...words);
                    wordCountElement["counts"]["footnotes"] += words.length;
                }
            }
            else if(fontsize === 12){
                // search for subsections
                if(isSubsectionHeading(item, subHeadline, defaultFontName)){
                    // save word counts
                    wordCounts.push({"headline": subHeadline, "counts": currentCounts, "words": currentWords});
                    
                    // re-initialize values
                    [currentCounts, currentWords, insideQuote] = initializeStateVars();
                    subHeadline = item["str"];
                    itemShouldStartANewLine = item["hasEOL"];
                    continue;
                }
                
                // find the default text font name, then make sure that font is used before counting words
                if(!defaultFontName){
                    if(x === 71){
                        // found the font that is used inside the text
                        // from a line that started at the left side of the page (to table or similar)
                        defaultFontName = item["fontName"];
                    }
                    else{
                        ignoredWords.push({"words": words, "reason": "Bad word indent in first text under headline " + subHeadline});
                        continue;
                    }
                }
                
                if((itemShouldStartANewLine || searchingForNewLine) && x != 71){
                    // line starts or previous word in line started
                    // at suspicious x value (likely text in table/equation)
                    itemShouldStartANewLine = true;
                    searchingForNewLine = true;
                    ignoredWords.push({"words": words, "reason": "Bad word indent text under headline " + subHeadline});
                    continue;
                }
                searchingForNewLine = false;
                itemShouldStartANewLine = item["hasEOL"];
                
                // words are in text within a section
                
                // count words inside or outside of quotes
                if(!containsQuotes(item["str"])){
                    if(!insideQuote){
                        // no quote shenanigans
                        currentWords["text"].push(...words);
                        currentCounts["text"] += words.length;
                    }
                    else{
                        // only words in quotes
                        currentWords["quotes"].push(...words);
                        currentCounts["quotes"] += words.length;
                    }
                }
                else{
                    // quote shenanigans
                    for(let word of words){
                        if(containsQuotes(word)){
                            // the word is a quotation mark
                            insideQuote = !insideQuote;
                            continue;
                        }
                        let wordType = insideQuote ? "quotes" : "text";
                        currentWords[wordType].push(word);
                        currentCounts[wordType] += 1;
                    }
                }
            }
        }
    }
    if(!firstSectionFound){ warnings.push("No first Section headline was found.") }
    else{ warnings.push("No chapter after last Section was found.") }
    
    return {"wordCounts": wordCounts, "warnings": warnings, "ignoredWords": ignoredWords};
}


//const pdfPath = '../../benchmark/main.pdf';
//console.log(countWords(pdfPath));
//const output = await countWords(pdfPath);
//console.log(output);
