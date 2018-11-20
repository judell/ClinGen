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
  let clinGenKeys = Object.keys(localStorage).filter( key => {
    return key.startsWith('clingen')
  })
  clinGenKeys.forEach( key => {
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
      }
      hlib.hApiSearch({url: testUrl}, callback)
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
          function callback(annos) {
            assertEquals(1, annos.length)
            assertEquals('["ClinGen","gene:TMEM260"]', JSON.stringify(annos[0].tags))
            assertEquals('haveGene', localStorage['clingen_state'])
            resolve()
          }
          hlib.hApiSearch({url: testUrl, tags:'gene:TMEM260'}, callback)
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
        assertEquals('inMonarchLookup', localStorage['clingen_state'])
        assertEquals('truncus arteriosus', localStorage['clingen_selection'])
        gather({invoke:"saveMonarchLookup()"})
        waitSeconds(2)
          .then(_ => {
            function callback(annos) {
              assertEquals(1, annos.length)
              assertEquals('["ClinGen","hpoLookup","monarchLookup","gene:TMEM260"]', JSON.stringify(annos[0].tags))
              assertEquals('haveGene', localStorage['clingen_state'])
              resolve()
            }
            hlib.hApiSearch({url: testUrl, tag:'monarchLookup'}, callback)
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
        assertEquals('inVariantIdLookup', localStorage['clingen_state'])
        assertEquals('564085', localStorage['clingen_selection'])
        gather({invoke:"saveVariantIdLookup()"})
        waitSeconds(2)
          .then(_ => {
            function callback(annos) {
              assertEquals(2, annos.length)
              annos.forEach(anno => {
                assertEquals('["ClinGen","variantIdLookup","gene:TMEM260"]', JSON.stringify(anno.tags))
              })
              assertEquals('haveGene', localStorage['clingen_state'])
              resolve()
            }
            hlib.hApiSearch({url: testUrl, tag:'variantIdLookup'}, callback)
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
        assertEquals('inAlleleIdLookup', localStorage['clingen_state'])
        assertEquals('CA7200051', localStorage['clingen_selection'])
        gather({invoke:"saveAlleleIdLookup()"})
        waitSeconds(2)
          .then(_ => {
            function callback(annos) {
              assertEquals(2, annos.length)
              annos.forEach(anno => {
                assertEquals('["ClinGen","alleleIdLookup","gene:TMEM260"]', JSON.stringify(anno.tags))
              })
              assertEquals('haveGene', localStorage['clingen_state'])
              resolve()
            }
            hlib.hApiSearch({url: testUrl, tag:'alleleIdLookup'}, callback)
          })
      })

    })
  },  

  })
  
      