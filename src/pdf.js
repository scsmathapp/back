// import fs from "fs";
// import PDFParser from "pdf2json";
//
// const pdf_path = "src/assets/KirttanGuide.pdf";
// const pdfParser = new PDFParser();
//
// pdfParser.on("pdfParser_dataError", (errData) =>
//     console.error(errData.parserError)
// );
//
// pdfParser.on("pdfParser_dataReady", (pdfData) => {
//     // console.log(pdfData.Pages);
//     fs.writeFile(
//         "src/assets/KG.json",
//         JSON.stringify(pdfData.Pages),
//         (data) => console.log(data)
//     );
// });
//
// pdfParser.loadPDF(pdf_path);

import kg from './assets/KG.json' assert { type: 'json' };

let txt = '';

kg[8].Texts.forEach(text => {
    text.R.forEach(str => {
        txt += str.T;
    });
});

console.log(txt);