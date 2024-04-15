import countWords from "./wordCounter.mjs";


const pdfPath = '../../benchmark/main.pdf';
//const pdfPath = 'test.pdf';

const output = await countWords(pdfPath);
console.log(output);
