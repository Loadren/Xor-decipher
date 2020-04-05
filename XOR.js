const path = require('path');
const fs = require('fs');
const { Worker, parentPort, workerData } = require('worker_threads')
var events = require('events');

var relativePath = path.join(__dirname, 'foobar.json');

var XORDecipher = module.exports = {

  lettersFrequencyInFrench : {
    "a" : 7.11, "i" : 6.59,
    "s" : 6.51, "n" : 6.39,
    "r" : 6.07, "t" : 5.92,
    "o" : 5.02, "l" : 4.96,
    "u" : 4.49, "d" : 3.67,
    "c" : 3.18, "m" : 2.62,
    "p" : 2.49, "é" : 1.94,
    "g" : 1.23, "b" : 1.14,
    "v" : 1.11, "h" : 1.11,
    "f" : 1.11, "q" : 0.65,
    "y" : 0.46, "x" : 0.38,
    "j" : 0.34, "è" : 0.31,
    "à" : 0.31, "k" : 0.29,
    "w" : 0.17, "z" : 0.15,
    "e" : 12.10, " " : 16.56
  },

  events : new events.EventEmitter(),

  encrypt : function(str, key){
    var output = [];
    var charCode;
    for (var i = 0; i < str.length; i++) {
      charCode = str.charCodeAt(i) ^ key[i % key.length].charCodeAt(0);

      output.push(String.fromCharCode(charCode));
    }
    return output.join("");
  },

  decryptBytes : function(byteArr, key){
    var output = [];
    var charCode;
    for (var i = 0; i < byteArr.length; i++) {
      charCode = byteArr[i] ^ key[i % key.length].charCodeAt(0);

      output.push(String.fromCharCode(charCode));
    }
    return output.join("");
  },

  generateKeys : function(array, result, index){
    if (!result) {
      result = [];
      index = 0;
      array = array.map(function(element) {
        return element.push ? element : [element];
      });
    }
    if (index < array.length) {
      array[index].forEach(function(element) {
        var a = array.slice(0);
        a.splice(index, 1, [element]);
        XORDecipher.generateKeys(a, result, index + 1);
      });
    } else {
      result.push(array.join(''));
    }

    return result;
  },

  isPrintable : function(string){

    // French Characters
    var ascii = /[^a-zA-Z0-9 àâäèéêëîïôœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ.,!()"'?;\-’\s@/\\\*`]+/; //If not in the french charset
    return !ascii.test(string);
  },

  freqScoreString : function(string){

    const alphabet = Object.keys(XORDecipher.lettersFrequencyInFrench);
    var frequencies = {};
    var allCharacters = 0;
    var score = 0;
    for (var i = 0; i < string.length; i++) {
      var char = string[i].toLowerCase()
      if(alphabet.indexOf(char) > -1){
        if(frequencies[char]) frequencies[char] += 1;
        else frequencies[char] = 1;
        allCharacters++;
      }
    }

    for (var char of alphabet) {
      if(frequencies[char] && XORDecipher.lettersFrequencyInFrench[char] && frequencies[char] !== NaN && XORDecipher.lettersFrequencyInFrench[char] !== NaN){
        frequencies[char] *= 100 / allCharacters;
        var a = 0;
        var b = 0;
        if(frequencies[char] > XORDecipher.lettersFrequencyInFrench[char]){
          b = frequencies[char];
          a = XORDecipher.lettersFrequencyInFrench[char];
        }else{
          a = frequencies[char];
          b = XORDecipher.lettersFrequencyInFrench[char];
        }

        score += a-b === 0 ? 100 : (100 - (100 * Math.abs( ( a - b ) / b  )));
      }else if(frequencies[char] == undefined || frequencies[char] == NaN && XORDecipher.lettersFrequencyInFrench[char] && XORDecipher.lettersFrequencyInFrench[char] !== NaN){
        frequencies[char] = 0;
        var a = 0;
        var b = 0;
        if(frequencies[char] > XORDecipher.lettersFrequencyInFrench[char]){
          b = frequencies[char];
          a = XORDecipher.lettersFrequencyInFrench[char];
        }else{
          a = frequencies[char];
          b = XORDecipher.lettersFrequencyInFrench[char];
        }

        score += a-b === 0 ? 100 : (100 - (100 * Math.abs( ( a - b ) / b  )));
      }
    }

    return score;

  },

  bruteforceKey : function(byteArr, alphabet, onlyLetters){
    alphabet = alphabet.split('');

    var sol1 = {letter : "", score : 0};
    var sol2 = {letter : "", score : 0};
    alphabet.filter((char, i) => {
      var decrypted = XORDecipher.decryptBytes(byteArr, char);
      var score = 0;
      score = XORDecipher.freqScoreString(decrypted);
      if(score > sol1.score) {
        sol2.letter = sol1.letter;
        sol2.score = sol1.score;
        sol1.letter = char;
        sol1.score = score;
      }else if(score > sol2.score) {
        sol2.letter = char;
        sol2.score = score;
      }
    });

    XORDecipher.events.emit('analyzed-one');

    if(onlyLetters) return [sol1.letter, sol2.letter];
    else return [sol1, sol2];

  },

  bruteforceBlocks : function(array, alphabet, onlyLetters){
    var solutions = [];

    for(var byteArr of array){
      solutions.push(XORDecipher.bruteforceKey(byteArr, alphabet, onlyLetters));
    }

    return solutions;
  },

  bruteforce : function(encryptedBytes, solutions){
    var allDecryptedPossibilities = []

    if(solutions.length < 4){
      //Multithreading
      const threadCount = solutions.length;
      const threads = new Set();;
      return new Promise(function(resolve, reject) {
        for (let i = 0; i < threadCount; i++) {
          threads.add(new Worker("./worker.js", { workerData: { encryptedBytes : encryptedBytes, solutionRange : [solutions[i]] }}));
        }

        for (let worker of threads) {
          worker.on('error', (err) => { throw err; });
          worker.on('exit', () => {
            threads.delete(worker);

            if(threads.size == 0){
              resolve(allDecryptedPossibilities);
            }
          })
          worker.on('message', (data) => {
            allDecryptedPossibilities = [...allDecryptedPossibilities, ...data];
          });
        }
      });
    }

    //Split solutions into 4
    var rest = solutions.length % 4, // how much to divide
    restUsed = rest, // to keep track of the division over the elements
    partLength = Math.floor(solutions.length / 4),
    result = [];

    for(var i = 0; i < solutions.length; i += partLength) {
      var end = partLength + i,
      add = false;

      if(rest !== 0 && restUsed) { // should add one element for the division
        end++;
        restUsed--; // we've used one division element now
        add = true;
      }

      result.push(solutions.slice(i, end)); // part of the array

      if(add) {
        i++; // also increment i in the case we added an extra element for division
      }
    }

    //Multithreading
    const threadCount = result.length;
    const threads = new Set();;
    return new Promise(function(resolve, reject) {
      for (let i = 0; i < threadCount; i++) {
        threads.add(new Worker("./worker.js", { workerData: { encryptedBytes : encryptedBytes, solutionRange : result[i] }}));
      }

      for (let worker of threads) {
        worker.on('error', (err) => { throw err; });
        worker.on('exit', () => {
          threads.delete(worker);

          if(threads.size == 0){
            resolve(allDecryptedPossibilities);
          }
        })
        worker.on('message', (data) => {
          allDecryptedPossibilities = [...allDecryptedPossibilities, ...data];
        });
      }
    });
  },

  arrangeBlocks : function(arrByte, keySize, length){
    if(!keySize || !arrByte) return null;

    var blocks = [];

    for(var i = 0; i<keySize; i++){
      blocks[i] = [];
    }

    if(arrByte.length/keySize < length || length == 0 || !length) length = Math.floor(arrByte.length/keySize);

    arrByte.map((char, i) => {
      if(blocks[i % blocks.length].length < length) blocks[i % blocks.length].push(char);
    });

    return blocks;
  },

  analyzeFrench : function(solutions){
    var analyzedPossibilities = [];

    //Split solutions into 8
    var rest = solutions.length % 8, // how much to divide
    restUsed = rest, // to keep track of the division over the elements
    partLength = Math.floor(solutions.length / 8),
    result = [];

    for(var i = 0; i < solutions.length; i += partLength) {
      var end = partLength + i,
      add = false;

      if(rest !== 0 && restUsed) { // should add one element for the division
        end++;
        restUsed--; // we've used one division element now
        add = true;
      }

      result.push(solutions.slice(i, end)); // part of the array

      if(add) {
        i++; // also increment i in the case we added an extra element for division
      }
    }

    //Multithreading
    const threadCount = result.length;
    const threads = new Set();;
    return new Promise(function(resolve, reject) {
      for (let i = 0; i < threadCount; i++) {
        threads.add(new Worker("./workerFrench.js", { workerData: { obj : result[i] }}));
      }

      for (let worker of threads) {
        worker.on('error', (err) => { throw err; });
        worker.on('exit', () => {
          threads.delete(worker);

          if(threads.size == 0){
            resolve(analyzedPossibilities);
          }
        })
        worker.on('message', (data) => {
          analyzedPossibilities.push(data);

          // Create a new event
          XORDecipher.events.emit('decrypted-one');
        });
      }
    });
  },

  decryptFile : async function(filePath){

    // Read all files
    var data = await fs.readFileSync(filePath)

    // Get byte per byte data
    var arrByte = Uint8Array.from(data)

    // Use blocks of distance 6 to find key
    var blocks = XORDecipher.arrangeBlocks(arrByte, 6);

    // Generate single keys solutions for blocks
    var solutions = XORDecipher.bruteforceBlocks(blocks, 'abcdefghijklmnopqrstuvwxyz', true);

    // Generate every combinaison of solutions based on last function
    solutions = XORDecipher.generateKeys(solutions);

    // Bruteforce bytes
    var possibilities = await XORDecipher.bruteforce(arrByte, solutions);

    // Create a new event
    XORDecipher.events.emit('progressLength', {progressLength : possibilities.length});

    // Apply french grammar rules to find the text
    // Comparing letters frequency with data (Source : https://www.nymphomath.ch/crypto/stat/francais.html ) to find best suited texts.
    // Multithreading to improve time required
    possibilities = await XORDecipher.analyzeFrench(possibilities);

    bestPossibilities = possibilities.sort((p1, p2) => p2.score - p1.score).slice(0, 5);

    return bestPossibilities;
  },

  decryptFileWithKey : async function(filePath, key){

    // Read all files
    var data = await fs.readFileSync(filePath)

    // Get byte per byte data
    var arrByte = Uint8Array.from(data)

    // Bruteforce bytes
    var possibilities = await XORDecipher.bruteforce(arrByte, [key]);

    return possibilities[0];
  },

  analyzeBlocks : async function(filePath){

    return new Promise(async function (resolve, reject){
      // Read all files
      var data = await fs.readFileSync(filePath)

      // Get byte per byte data
      var arrByte = Uint8Array.from(data)

      // Use blocks of distance 6 to find key
      var blocks = XORDecipher.arrangeBlocks(arrByte, 6);

      // Create a new event
      XORDecipher.events.emit('progressLength', {progressLength : blocks.length});

      // Generate single keys solutions for blocks
      var solutions = XORDecipher.bruteforceBlocks(blocks, 'abcdefghijklmnopqrstuvwxyz');

      resolve(solutions);
    });
  }

}
