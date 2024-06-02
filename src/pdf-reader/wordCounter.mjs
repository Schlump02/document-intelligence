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
    
    const unwantedWords = ["", ",", ".", ";", ":", "_", "|", "!", "?", "'", "²", "³",
                            "`", "/", "\\", "(", ")", "[", "]", "{", "}", "<", "~",
                            "$", "€", "[sic]", "[sic!]", "(!)", "[!]", "\\.",
                            ">", "*", "&", "#", "@", "%", "^", "=", "+"
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

// find out if the string is the start of an unordered list item
// since deeper list levels may be a mix of ordered and unordered lists,
// all labels typical top one level must be checked, up to the max possible level
function containsUnorderedListLabelsUpToLevel(rawStr, level){
    if(level >= 1){
        if(rawStr.startsWith("•")) { return true; }
    }
    if(level >= 2){
        if(rawStr.startsWith("◦") || rawStr.startsWith("–")) { return true; }
    }
    if(level >= 3){
        if(rawStr.startsWith("∗") || rawStr.startsWith("–") || rawStr.startsWith("-")) { return true; }
    }
    if(level >= 4){
        if(rawStr.startsWith("·")) { return true; }
    }
    return false;
}
function containsOrderedListLabelsUpToLevel(rawStr, level){
    let allegedItemIdentifier = "";
    if(level >= 1){
        allegedItemIdentifier = rawStr.split(".")[0];
        if(!isNaN(allegedItemIdentifier)) { return true; }// 1. 2. 3. ...
    }
    if(level >= 2){
        allegedItemIdentifier = rawStr.split(".")[0];
        if(rawStr.split(" ")[0].includes(")")) { return true; }// a) b) c) ...
    }
    if(level >= 3){
        allegedItemIdentifier = rawStr.split(" ")[0];// i. ii. iii. ...
        if(allegedItemIdentifier.includes(".") && allegedItemIdentifier.toLowerCase() === allegedItemIdentifier) { return true; }
    }
    if(level >= 4){
        allegedItemIdentifier = rawStr.split(" ")[0];// A. B. C. ...
        if(allegedItemIdentifier.includes(".") && allegedItemIdentifier.toUpperCase() === allegedItemIdentifier) { return true; }
    }
    return false;
}
function containsCorrectLabels(rawStr, level){
    if(containsUnorderedListLabelsUpToLevel(rawStr, level) || containsOrderedListLabelsUpToLevel(rawStr, level)){
        return true;
    }
    return false;
}

function checkListLevel(x, rawStr, currentListLevel){
    let allegedItemIdentifier = "";
    
    if(x === 85){
        if(containsUnorderedListLabelsUpToLevel(rawStr, 1)){
            // unordered list
            return 1;
        }
        allegedItemIdentifier = rawStr.split(".")[0];
        if(!isNaN(allegedItemIdentifier) && allegedItemIdentifier < 10){
            // ordered list item < 10.
            return 1;
        }
    }
    else if(x === 79){
        allegedItemIdentifier = rawStr.split(".")[0];
        if(!isNaN(allegedItemIdentifier) && allegedItemIdentifier >= 10){
            // ordered list item > 10.
            return 1;
        }
    }
    else if(x > 107 && x < 115){// looks like second level list
        if(containsCorrectLabels(rawStr, 2)){ return 2; }
    }
    else if(x < 139){// looks like third level list
        if(containsCorrectLabels(rawStr, 3)){ return 3; }
    }
    else if(x < 160){// looks like fourth level list
        if(containsCorrectLabels(rawStr, 4)){ return 4; }
    }
    return 0;
}

function containsQuotes(str){
    return str.includes('"') || str.includes("„") || str.includes("“")
}

function removeQuotationMarks(words){
    const marks = ['"', '„', '“'];
    return words.filter(element => !marks.includes(element));
}

function removeListLabelChars(words){
    const undorderedListLabels = ['–', '-', '•', '◦', '∗', '·'];
    return words.filter(element => !undorderedListLabels.includes(element));
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
        console.log(`Warning: the expected marker ${expectedMarkNum} did not fit the found marker ${plausibleNextMarker} in ${markNums}`);
        return 0;
    }
}


export default async function countWords(src) {
    const doc = await pdfjs.getDocument(src).promise;
    
    let itemsSinceLastSectionHeadline = 0;
    let itemsSinceLastFootnoteMarker = 0;
    let listLevel = 0;
    
    let expectedLineStartX = [71];
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
            console.log(item);
            
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
            
            // skip page numbers
            if(y < 60){
                // only page numbers are placed this low
                itemShouldStartANewLine = true;
                continue;
            }
            
            // skip word counting?
            if(!firstSectionFound              // don't count words outside of sections
                || item["str"].length < 1      // no words to count
                || item["transform"][1] != 0   // text is rotated
                || item["transform"][2] != 0   // text is rotated
                || item["transform"][0] != item["transform"][3]){ // text is rotated
                
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
                        console.log(`New Marker ${markNum} found under headline ${subHeadline}. footnoteHeadlines is now [${footnoteHeadlines}]`);
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
                itemShouldStartANewLine = item["hasEOL"];
                if(itemShouldStartANewLine && !expectedLineStartX.includes(x)){
                    // unexpected text indent
                    searchingForNewLine = true;
                }
                // no words to count
                continue;
            }
            
            itemsSinceLastSectionHeadline += 1;
            
            if(fontsize === 10 && x === 83){
                // words in footnotes
                words = removeQuotationMarks(words);
                words = removeListLabelChars(words);
                
                if(["Abbildung", "Tabelle"].includes(words[0]) && words[1].includes(":") && itemsSinceLastFootnoteMarker > 2){
                    // caption was incorrectly identified as footnote
                    continue;
                }
                itemsSinceLastFootnoteMarker = 0;
                
                // make sure to assign the words and word counts to the correct headline
                let correspondingHeadline = footnoteHeadlines.shift();
                if(subHeadline === correspondingHeadline){
                    //console.log("d1", item, correspondingHeadline, footnoteHeadlines);
                    currentWords["footnotes"].push(...words);
                    currentCounts["footnotes"] += words.length;
                }
                else{
                    let wordCountElement = wordCounts.find(element => element.headline === correspondingHeadline);
                    //console.log("d2", item, correspondingHeadline, footnoteHeadlines);
                    wordCountElement["words"]["footnotes"].push(...words);
                    wordCountElement["counts"]["footnotes"] += words.length;
                }
            }
            else if(fontsize === 12){
                itemsSinceLastFootnoteMarker += 1;
                
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
                else if(item["fontName"] != defaultFontName && currentCounts["text"] + currentCounts["quotes"] === 0 && listLevel < 1){
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
                
                console.log((itemShouldStartANewLine || searchingForNewLine) && !expectedLineStartX.includes(x));
                if((itemShouldStartANewLine || searchingForNewLine) && !expectedLineStartX.includes(x)){
                    // unexpected text indent
                    
                    //check if its part of a \begin{displayquote} block
                    if(x === 100){
                        // count words in quotes
                        currentWords["quotes"].push(...words);
                        currentCounts["quotes"] += words.length;
                        continue;
                    }
                    
                    // check if it might be part of an (un)ordered list
                    console.log("d3 - checking if list starts with string:", item["str"])
                    listLevel = checkListLevel(x, item["str"], listLevel);
                    if(listLevel > 0){
                        console.log("d4 - beginning of list found with listLevel", listLevel, "and words", words);
                        
                        // lines in lists start at x = 100 for first level, x = 126 for second level etc.
                        expectedLineStartX = [71, 100, 126, 148, 168].slice(0, listLevel + 1);
                        if(words.length < 2){ continue; }
                        words.shift();// count words except for numbering marker
                    }
                    else{
                        // line starts or previous word in line started at suspicious x value (likely text in table/equation)
                        itemShouldStartANewLine = true;
                        searchingForNewLine = true;
                        ignoredWords.push({"words": words, "headline": subHeadline, "reason": "unexpected text indent", "x": x});
                        continue;
                    }
                }
                
                // words are in text within a section
                searchingForNewLine = false;
                itemShouldStartANewLine = item["hasEOL"];
                words = removeListLabelChars(words);
                
                if(x === 71){
                    // list indentation is over, expect only normal line start
                    expectedLineStartX = [71];
                }
                
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
