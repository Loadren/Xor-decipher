const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

const directoryPath = path.join(__dirname, "CRYPTED_FILES");

var XORDecipher = {

  analyzeFrench : function(solutions){
    //Split solutions into 4
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
        threads.add(new Worker("./workerFrench.js", { workerData: { encryptedBytes : encryptedBytes, solutionRange : result[i] }}));
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

}

XORDecipher.decryptAll();
