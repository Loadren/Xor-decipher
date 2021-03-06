const { parentPort, workerData } = require('worker_threads')
const path = require('path');
const fs = require('fs');

var XORDecipher = {

  decryptBytes : function(byteArr, key){
    var stringHex = byteArr.toString('hex');
    var output = [];
    var charCode;
    for (var i = 0; i < byteArr.length; i++) {
      charCode = byteArr[i] ^ key[i % key.length].charCodeAt(0);

      output.push(String.fromCharCode(charCode));
    }
    return output.join("");
  },

  decryptByteArray : function(encryptedBytes, solutions){
      var decryptedPossibilities = [];
      solutions.map((sol, index) => {
        var decryptedOne = XORDecipher.decryptBytes(encryptedBytes, sol);
        decryptedPossibilities.push({decrypted : decryptedOne, key : sol});
      });
      return decryptedPossibilities;
  },

}


var decrypted = XORDecipher.decryptByteArray(workerData.encryptedBytes, workerData.solutionRange);

parentPort.postMessage(decrypted);
