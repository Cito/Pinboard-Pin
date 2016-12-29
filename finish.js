// finish built extension
// (slim it down and remove random hashes chunk hashes)

const fs = require('fs');
const path = require('path');
const uglify = require("uglify-js");

const buildDir = 'dist';
const fullPath = f => path.join(buildDir, f);
const indexFile = fullPath('index.html');
const inlineBundle = fullPath('inline.bundle.js');

if (!fs.existsSync(fullPath('main.bundle.js'))) {

  // remove unnecessary gz and map files
  fs.readdirSync(buildDir).filter(
    f => f.match(/\.(gz|map)$/)).forEach(
    f => fs.unlinkSync(fullPath(f)));

  // remove chunk hashes from the names of the bundles
  // this makes builds reproducible so that they can be reviewed
  const regexBundle = /\.([0-9a-f]{20})\.bundle\./g;
  const cleanBundle = f => f.replace(regexBundle, '.bundle.');

  fs.readdirSync(buildDir).filter(
    f => f.match(regexBundle)).forEach(
    f => fs.renameSync(fullPath(f), fullPath(cleanBundle(f))));

  let src = fs.readFileSync(indexFile, 'utf8');
  src = cleanBundle(src);
  fs.writeFileSync(indexFile, src, {flag: 'w'});

  src = fs.readFileSync(inlineBundle, 'utf8');
  src = src.replace(/:"[0-9a-f]{20}"/g, ':""');
  // minify again with new content to create reproducible content
  src = uglify.minify(src, {fromString: true}).code;
  fs.writeFileSync(inlineBundle, src, {flag: 'w'});
}