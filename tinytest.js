// inspired by https://github.com/joewalnes/jstinytest
// promisified for this project

const green = '#99ff99';

const red =  '#ff9999';

let testName

function log(msg) {
  document.getElementById('log').innerHTML += `<div>${msg}</div>`
}

function logError(msg) {
  document.getElementById('log').innerHTML += `<div style="background-color:${red}">${msg}</div>`
}

const TinyTest = {

  run: function(tests) {
    log(testName = 'init')
    tests[testName]()
    .then( () => {
    log(testName = 'finish')
    tests[testName]()
    .then( () => {
    alert('done')
    }) }) 
  },

  assert: function(value) {
    if (!value) {
      let msg = `${testName}: ${value}`
      console.error(msg)
      logError(msg)
    }
  },

  assertEquals: function(expected, actual) {
    if (expected != actual) {
      let msg = `${testName}: expected ${expected}, actual ${actual}`
      console.error(msg)
      logError(msg)
    }
  },
  
};

const assert              = TinyTest.assert,
      assertEquals        = TinyTest.assertEquals,
      eq                  = TinyTest.assertEquals, // alias for assertEquals
      tests               = TinyTest.run;

setTimeout(function() { 
  if (window.document && document.body) {
    document.body.style.backgroundColor = green
  }
}, 0)

tests({ 
  'init'  : function () {
    return new Promise( resolve => {
      alert('init')
      resolve()
      })
    },

  'finish'  : function () {
    return new Promise( resolve => {
      alert('finish')
      resolve()
      })
    }
  
  })
      