const path = require('path');
const fs = require('fs');
const { Worker, parentPort, workerData } = require('worker_threads')

const directoryPath = path.join(__dirname, "CRYPTED_FILES");

var XORDecipher = {

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

  isPrintable : function(string){

    // French Characters
    var ascii = /[^a-zA-Z0-9 àâäèéêëîïôœùûüÿçÀÂÄÈÉÊËÎÏÔŒÙÛÜŸÇ.,!()"'?;\-’\s@/\\\*`]+/; //If not in the french charset
    return !ascii.test(string);
  },

  seemsFrench : function(str){

    var punctuationSymbols = "!?;:.,'".split("");
    var score = 0;
    var scoreCompte = 0;

    // apostrophe, printable and punctuation rules
    var apostropheRespected = 0;
    var apostropheEncountred = 0;
    var punctuationRespected = 0;
    var punctuationEncountred = 0;
    var printableChar = 0;

    for(var i=0; i<str.length;i++) {
      if (str[i] === "'"){
        apostropheEncountred++;
        if(str[i+1] /*if end of string*/ && ["a","e","i","o","u","y","h"].indexOf(str[i+1]) > -1){
          apostropheRespected++
        }
      }else if (punctuationSymbols.indexOf(str[i]) > -1){
        punctuationEncountred++;
        if(str[i+1] /*if end of string*/ && punctuationSymbols.indexOf(str[i+1]) > -1){
          punctuationRespected++;
        }
      }

      if(XORDecipher.isPrintable(str[i])){
        printableChar++;
      }

    }
    if(apostropheEncountred == 0) scoreCompte -= 1;
    score += apostropheRespected * 20 / apostropheEncountred;
    scoreCompte++;
    if(punctuationEncountred == 0) scoreCompte -= 1;
    score += punctuationRespected * 20 / punctuationEncountred;
    scoreCompte++;
    score += printableChar * 20 / str.length;
    scoreCompte++;

    score = score / scoreCompte;

    //Dictionnary test
    var data = fs.readFileSync("./liste_francais.txt");
    score += XORDecipher.dictionnaryAttack(str, data)*5;

    //vowels rules
    //average word length ( http://jeunesecrivains.superforum.fr/t23881-longueur-moyenne-des-mots-francais )
    var avgWordLength = 5;
    var strAvgWordLength = 0;
    var vowels = ["a","e","i","o","u","y"];
    var words = str.split(' ');
    var wordsContainingVowels = 0;
    for(var word of words){
      for (var vowel of vowels) {
        if (word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").indexOf(vowel) > -1) {
          wordsContainingVowels++;
        }
      }
      strAvgWordLength += word.length;
    }
    strAvgWordLength /= words.length;

    score += wordsContainingVowels * 20 / words.length;
    score += 50 - (50*Math.abs( (strAvgWordLength - avgWordLength) / ( (strAvgWordLength + avgWordLength)/2 ) ));


    score += XORDecipher.freqScoreString(str);

    return score;
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

  dictionnaryAttack : function(string, data){

    var stringWords = string.split(' ');
    var word = "";
    var frenchWordsCount = 0;
    var charCode;
    var frenchWords = {};
    var word = "";
    for (var i = 0; i < data.length; i++) {
      if(String.fromCharCode(data[i]) == "\r"){
        i++;
        frenchWords[word] = true;
        word = "";
      }else{
        word += String.fromCharCode(data[i]);
      }
    }

    for(word of stringWords){
      if(frenchWords[word] !== undefined){
        frenchWordsCount++;
      }
    }

    return frenchWordsCount;

  },

}

for(var possibility of workerData.obj){
  possibility.score = XORDecipher.seemsFrench(possibility.decrypted);
  parentPort.postMessage(possibility);
}
