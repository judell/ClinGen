// inspired by https://github.com/joewalnes/jstinytest
// promisified for this project

const green = '#99ff99';

const red =  '#ff9999';

let testName

let testUrl = 'http://10.0.0.9:8000/test.html'

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
    log(testName = 'geneNameSelectionIsSuccessful')
    tests[testName]()
    .then( () => {
    log(testName = 'monarchLookupIsSuccessful')
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
      function callback(annos, replies) {
        annos = annos.concat(replies)
        annos.forEach(anno => {
          hlib.deleteAnnotation(anno.id, hlib.getToken())
        })
        waitSeconds(2)
        .then( _ =>{
          assertEquals(localStorage['clingen_state'],'needGene')
          resolve()
        })
      }
      hlib.hApiSearch({url: testUrl}, callback)
    })
  },

  'geneNameSelectionIsSuccessful': function () {
    return new Promise(resolve => {
      let selection = window.getSelection()
      window.getSelection().selectAllChildren(hlib.getById('geneName'))
      waitSeconds(2)
        .then(_ => {
          gather({ invoke: "getGene()" })
        })
        .then(_ => {
          waitSeconds(2)
            .then(_ => {
              function callback(annos) {
                assertEquals(1, annos.length)
                assertEquals('["ClinGen","gene:TMEM260"]', JSON.stringify(annos[0].tags))
                assertEquals('haveGene', localStorage['clingen_state'])
                resolve()
              }
              hlib.hApiSearch({url: testUrl, tags:'gene:TMEM260'}, callback)
            })
        })
    })
  },

  'monarchLookupIsSuccessful': function () {
    return new Promise(resolve => {
      let params = {
        "uri":"https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5384036/",
        "exact":"truncus arteriosus",
        "prefix":" complex heart defect including ",
        "selection":"truncus arteriosus",
        "start":12766,"end":12784,
        "doi":"10.1016/j.ajhg.2017.02.007",
        "pmid":"28318500",
        "tags":["ClinGen","doi:10.1016/j.ajhg.2017.02.007","pmid:28318500"]
      }      
      ClinGenWindow.postMessage(params, '*')
      gather({invoke:"FSM.beginMonarchLookup()"})
      gather({invoke:"app(reloadEvent)"})
      waitSeconds(2)
        .then(_ => {
          assertEquals('inMonarchLookup', localStorage['clingen_state'])
          assertEquals('truncus arteriosus', localStorage['clingen_selection'])
          gather({invoke:"saveMonarchLookup()"})
          waitSeconds(2)
            .then(_ => {
              function callback(annos) {
                assertEquals(2, annos.length)
                assertEquals('["ClinGen","hpoLookup","monarchLookup","gene:TMEM260"]', JSON.stringify(annos[0].tags))
                assertEquals('haveGene', localStorage['clingen_state'])
                resolve()
              }
              hlib.hApiSearch({url: testUrl, tags:'monarchLookup'}, callback)
            })
        })
    })
  }

  })
  
      