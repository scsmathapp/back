var fs = require('fs');
var files = fs.readdirSync('./songs');

files.forEach(file => {
    console.log(file);
    var filename = './songs/' + file;
    var text = fs.readFileSync( filename, { encoding: 'utf8', flag: 'r' });
    console.log(text);
    fs.writeFileSync(filename, text + '\n> page = ');
});