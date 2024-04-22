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
    return plausibleNumbering.includes(item["str"].split(" ")[0]);
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
                            ">", "*", "&", "#", "@", "%", "^", "=", "+", "~", "–"
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

/**
 * when a footnote marker was found but didn't immediately equal the next expected marker number, check if it consists of multiple expected numbers after each other, ignore otherwise (e.g., if the number belonged to a footnote at the page bottom, which should not be counted again.)
 */
function identifyMultipleMarkers(markNums, expectedMarkNum){
    const expectedMarkNumDigits = parseInt(expectedMarkNum.toString().length);
    const plausibleNextMarker = parseInt(markNums.substring(0, expectedMarkNumDigits));
    const remainingMarkNums = markNums.substring(expectedMarkNumDigits);
    
    if(expectedMarkNum === plausibleNextMarker){
        console.log(`expected marker ${expectedMarkNum} matches the found marker ${plausibleNextMarker} in ${markNums}`);
        if(remainingMarkNums.length > 0){
            return 1 + identifyMultipleMarkers(remainingMarkNums, expectedMarkNum + 1);
        }
        return 1;
    }
    else {
        //console.log(`Warning: the expected marker ${expectedMarkNum} did not fit the found marker ${plausibleNextMarker} in ${markNums}`);
        return 0;
    }
}


export default async function countWords(src) {
    const doc = await pdfjs.getDocument(src).promise;
    
    let itemsSinceLastSectionHeadline = 0;
    let headlinePageNum = 0;
    
    let footnoteHeadlines = [];
    let footnoteCount = 0;
    
    let [currentCounts, currentWords, insideQuote] = initializeStateVars();
    
    let [wordCounts, warnings, ignoredWords] = [[], [], []];
    let [headline, subHeadline, defaultFontName] = ["", "", ""];
    let [firstSectionFound, itemShouldStartANewLine, searchingForNewLine] = [false, false, false];
    
    for(let currentPageNum = 1; currentPageNum <= doc.numPages; currentPageNum++){
        const pageContent = await doc.getPage(currentPageNum).then(page => page.getTextContent());
        
        for(let item of pageContent.items){
            let fontsize = Math.round(item["height"]);
            let x = Math.round(item["transform"][4]);
            let y = Math.round(item["transform"][5]);
            //console.log(item);
            
            if(fontsize === 14){
                // check if this item is part of an existing section headline
                if(firstSectionFound && itemsSinceLastSectionHeadline < 1 && currentPageNum === headlinePageNum){
                    headline += " " + item["str"];
                    subHeadline = headline;
                    continue;
                }
                // new section headline found
                itemsSinceLastSectionHeadline = 0;
                headlinePageNum = currentPageNum;
                
                let prevHeadline = subHeadline;
                headline = item["str"];
                subHeadline = headline;
                
                if(firstSectionFound){
                    // save word counts
                    wordCounts.push({"headline": prevHeadline, "counts": currentCounts, "words": currentWords});
                    
                    if(isChapterAfterLastSection(headline)){
                        // iterated through all sections, finish counting
                        warnings.push("Word count stopped after reaching headline: " + headline);
                        if(footnoteHeadlines.length > 0){
                            warnings.push(`Warning: ${footnoteHeadlines.length} footnotes not found.`);
                        }
                        return {"wordCounts": wordCounts, "warnings": warnings, "ignoredWords": ignoredWords};
                    }
                    // otherwise, re-initialize values
                    [currentCounts, currentWords, insideQuote] = initializeStateVars();
                }
                else if(headline.startsWith("1 ")){
                    firstSectionFound = true;// first section found, start counting with the next string
                    itemShouldStartANewLine = item["hasEOL"];
                }
                continue;
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
                // the footnote words will be counted under the correct headline
                let markNum = parseInt(item["str"]);
                // check that the mark contains next expected number(s)
                if(markNum){
                    if(markNum == footnoteCount + 1){
                        footnoteHeadlines.push(subHeadline);
                        footnoteCount += 1;
                    }
                    else{
                        // possible shenanigans due to multiple markers in one string
                        // also, this will return 0 for markers that were found in the page bottom, as those should not be counted
                        const foundMarkNumsCount = identifyMultipleMarkers(markNum.toString(), footnoteCount + 1);
                        // append the subheadline as often as there were marks found
                        footnoteHeadlines = [...footnoteHeadlines, ...Array(foundMarkNumsCount).fill(subHeadline)];
                        footnoteCount += foundMarkNumsCount;
                    }
                }
            }
            
            // sanitize words before counting
            let words = getSanitizedWords(item["str"]);
            if(!words || !words.length){
                // no words to count
                itemShouldStartANewLine = item["hasEOL"];
                continue;
            }
            
            itemsSinceLastSectionHeadline += 1;
            
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
                    let wordCountElement = wordCounts.find(element => element.headline === correspondingHeadline);
                    //console.log(item, correspondingHeadline);
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
                else if(item["fontName"] != defaultFontName && currentCounts["text"] + currentCounts["quotes"] === 0){
                    // this item could possibly be part of the new subheadline
                    if(x == 92 || x == 101 || x== 110 || !itemShouldStartANewLine){
                        // found subheadline longer than one line (suspiciously indented) or split in multiple items
                        subHeadline += " " + item["str"];
                        itemShouldStartANewLine = item["hasEOL"];
                        continue;
                    }
                }
                
                // find the default text font name, then make sure that font is used before counting words
                if(!defaultFontName){
                    if(x === 71){
                        // found the font that is used inside the text
                        // from a line that started at the left side of the page (to table or similar)
                        defaultFontName = item["fontName"];
                    }
                    else{
                        ignoredWords.push({"words": words, "headline": subHeadline, "reason": "unexpected word indent in first text", "x": x});
                        continue;
                    }
                }
                
                if((itemShouldStartANewLine || searchingForNewLine) && x != 71){
                    // unexpected text indent, check if its part of a \begin{displayquote} block
                    if(x === 100){
                        // count words in quotes
                        currentWords["quotes"].push(...words);
                        currentCounts["quotes"] += words.length;
                        continue;
                    }
                    // line starts or previous word in line started at suspicious x value (likely text in table/equation)
                    itemShouldStartANewLine = true;
                    searchingForNewLine = true;
                    ignoredWords.push({"words": words, "headline": subHeadline, "reason": "unexpected text indent", "x": x});
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
