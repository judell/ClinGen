// inspired by https://github.com/joewalnes/jstinytest
// promisified for this project

const green = '#99ff99';

const red =  '#ff9999';

let testName

async function waitSeconds(seconds, data) {
  await delay(seconds)
  return data
  }

function delay(seconds) {
  return new Promise( resolve => setTimeout(resolve, seconds * 1000))
}  

function log(msg) {
  document.getElementById('log').innerHTML += `<div>${msg}</div>`
}

function logError(msg) {
  document.getElementById('log').innerHTML += `<div style="background-color:${red}">${msg}</div>`
}

const TinyTest = {

  run: function(tests) {

    log(testName = 'initialStateIsNeedGene')
    tests[testName]()
    .then( () => {
    log(testName = 'nextStateIsHaveGene')
    tests[testName]()
    .then( () => {
    log(testName = '3')
    tests[testName]()
    .then( () => {
    log('done')
    }) }) }) 
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
  'initialStateIsNeedGene'  : function () {
    return new Promise( resolve => {
      let clinGenKeys = Object.keys(localStorage).filter( key => {
        return key.startsWith('clingen')
      })
      clinGenKeys.forEach( key => {
        localStorage.removeItem(key)
      })
      // let the app window load
      waitSeconds(2)
        .then( _ => {
          assertEquals(localStorage['clingen_state'],'needGene')
          resolve()
        })
      })
    },

    'nextStateIsHaveGene'  : function () {
      return new Promise( resolve => {
        let selection = window.getSelection()
        window.getSelection().selectAllChildren(hlib.getById('geneName'))
        waitSeconds(2)
          .then( _ => {
            gather({invoke:"getGene()"})
          })
          .then( _ => {
            waitSeconds(2)
              .then( _ => {
                assertEquals(localStorage['clingen_state'],'haveGene')
                resolve()
              })
          })
        })
      },
  
    '3'  : function () {
      return new Promise( resolve => {
        resolve()
        })
      }
  
    
  })
      