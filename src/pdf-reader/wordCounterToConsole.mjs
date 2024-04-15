import countWords from "./wordCounter.mjs";


//const pdfPath = '../../benchmark/main.pdf';
const pdfPath = '2024-04-15T13-39-15.569+02-00-2127f6-main.pdf';
//const pdfPath = 'test.pdf';

const output = await countWords(pdfPath);
console.log(output);
