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

function clearLocalStorage() {
  let keys = Object.keys(localStorage).filter( key => {
    return key.startsWith(appWindowName)
  })
  keys.forEach( key => {
    delete localStorage[key]
  })
}

const TinyTest = {

  run: function(tests) {

    clearLocalStorage()

    log(testName = 'articleAnnotationsAreRemoved')
    tests[testName]()
    .then( _ => {
    log(testName = 'geneNameSelectionIsSuccessful')
    tests[testName]()
    .then( _ => {
    log(testName = 'monarchLookupIsSuccessful')
    tests[testName]()
    .then( _ => {
    log(testName = 'variantIdLookupIsSuccessful')
    tests[testName]()
    .then( _=> {
    log(testName = 'alleleIdLookupIsSuccessful')
    tests[testName]()
    .then( _ => {
      log('done')
    }) }) }) }) })
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

  'articleAnnotationsAreRemoved': function() {
    return new Promise ( resolve => {
      function callback(annos) {
      }
      hlib.search({url: testUrl})
      .then( data => {
        let annos = data[0]
        if ( annos.length === 0 ) {
          resolve()
        }
        for ( let i = 0; i < annos.length; i++ ) {
          let anno = annos[i]
          let r = hlib.deleteAnnotation(anno.id, hlib.getToken())
          r.then(data => { assertEquals(200, data.status) })
          if ( i+1 === annos.length) {
            resolve()
          }
        }
      })
    })
  },

  'geneNameSelectionIsSuccessful': function () {
    return new Promise(resolve => {
      let selection = window.getSelection()
      let geneName = hlib.getById('geneName')
      geneName.style.color = 'red'
      selection.selectAllChildren(geneName)
      gather({ invoke: "getGene()" })
      waitSeconds(5)
        .then(_ => {
          hlib.search({url: testUrl, tags:'gene:TMEM260'})
          .then (data => {
            let annos = data[0]
            assertEquals(1, annos.length)
            assertEquals(`["${appWindowName}","gene:TMEM260"]`, JSON.stringify(annos[0].tags))
            assertEquals('haveGene', localStorage[`${appWindowName}_state`])
            resolve()
          })
        })
      })
  },

  'monarchLookupIsSuccessful': function () {
    return new Promise(resolve => {
      let selection = window.getSelection()
      let hpoLookupTerm = hlib.getById('hpoLookupTerm')
      hpoLookupTerm.style.color = 'red'
      selection.selectAllChildren(hpoLookupTerm)
      gather({invoke:"FSM.beginMonarchLookup()"})
      waitSeconds(2)
      .then(_ => {
        assertEquals('inMonarchLookup', localStorage[`${appWindowName}_state`])
        assertEquals('truncus arteriosus', localStorage[`${appWindowName}_selection`])
        gather({invoke:"saveMonarchLookup()"})
        waitSeconds(2)
          .then(_ => {
            hlib.search({url: testUrl, tag:'monarchLookup'})
            .then ( data => {
              let annos = data[0]
              assertEquals(1, annos.length)
              assertEquals(`["${appWindowName}","hpoLookup","monarchLookup","gene:TMEM260"]`, JSON.stringify(annos[0].tags))
              assertEquals('haveGene', localStorage[`${appWindowName}_state`])
              resolve()
            })
          })
      })
  })
  },

  'variantIdLookupIsSuccessful': function() {
    return new Promise(resolve => {
      let selection = window.getSelection()
      let variantId = hlib.getById('variantId')
      variantId.style.color = 'red'
      selection.selectAllChildren(variantId)
      gather({invoke:"FSM.beginVariantIdLookup()"})
      waitSeconds(2)
      .then(_ => {
        assertEquals('inVariantIdLookup', localStorage[`${appWindowName}_state`])
        assertEquals('564085', localStorage[`${appWindowName}_selection`])
        gather({invoke:"saveVariantIdLookup()"})
        waitSeconds(2)
          .then(_ => {
            hlib.search({url: testUrl, tag:'variantIdLookup'})
            .then ( data => {
              let annos = data[0]
              assertEquals(2, annos.length)
              annos.forEach(anno => {
                assertEquals(`["${appWindowName}","variantIdLookup","gene:TMEM260"]`, JSON.stringify(anno.tags))
              })
              assertEquals('haveGene', localStorage[`${appWindowName}_state`])
              resolve()
            })
          })
      })

    })
  },

  'alleleIdLookupIsSuccessful': function() {
    return new Promise(resolve => {
      let selection = window.getSelection()
      let alleleId = hlib.getById('alleleId')
      alleleId.style.color = 'red'
      selection.selectAllChildren(alleleId)
      gather({invoke:"FSM.beginAlleleIdLookup()"})
      waitSeconds(2)
      .then(_ => {
        assertEquals('inAlleleIdLookup', localStorage[`${appWindowName}_state`])
        assertEquals('CA7200051', localStorage[`${appWindowName}_selection`])
        gather({invoke:"saveAlleleIdLookup()"})
        waitSeconds(2)
          .then(_ => {
            hlib.search({url: testUrl, tag:'alleleIdLookup'})
            .then (data => {
              let annos = data[0]
              assertEquals(2, annos.length)
              annos.forEach(anno => {
                assertEquals(`["${appWindowName}","alleleIdLookup","gene:TMEM260"]`, JSON.stringify(anno.tags))
              })
              assertEquals('haveGene', localStorage[`${appWindowName}_state`])
              resolve()
            })
          })
      })

    })
  },  

  })
  
      