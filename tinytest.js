// inspired by https://github.com/joewalnes/jstinytest
// promisified for this project

const green = '#99ff99'

const red = '#ff9999'

let testName

const testUser = 'judell'

const testUrl = 'http://localhost:8001/test.html'

function waitSeconds(seconds) {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

function log(msg) {
	document.getElementById('log').innerHTML += `<div>${msg}</div>`
}

function logError(msg) {
	document.getElementById('log').innerHTML += `<div style="background-color:${red}">${msg}</div>`
}

function clearLocalStorage() {
	let keys = Object.keys(localStorage).filter((key) => {
		return key.startsWith(appWindowName)
	})
	keys.forEach((key) => {
		delete localStorage[key]
	})
}

async function cleanup() {
  return new Promise(resolve => {
    async function worker() {
      const data = await hlib.search({
        url: testUrl,
        user: testUser
      })
      const rows = data[0].concat(data[1])
      rows.forEach(row => {
        hlib.deleteAnnotation(row.id)
          .then( r => { console.log(r) } )
      })
      resolve()
    }
    worker()
  })
}

const TinyTest = {
	run: async function(tests) {
		clearLocalStorage()

		const testNames = Object.keys(tests)

		for (i = 0; i < testNames.length; i++) {
			const testName = testNames[i]
			await tests[testName]()
			log(testName)
		}

		log('done')
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
	}
}

const assert = TinyTest.assert,
	assertEquals = TinyTest.assertEquals,
	eq = TinyTest.assertEquals, // alias for assertEquals
	tests = TinyTest.run

setTimeout(function() {
	if (window.document && document.body) {
		document.body.style.backgroundColor = green
	}
}, 0)

tests({
	articleAnnotationsAreRemoved: function() {
		return new Promise((resolve) => {
			async function runTest() {
				const data = await hlib.search({
					url: testUrl,
					user: testUser
				})
				const annos = data[0]
				if (annos.length === 0) {
					return
				}
				for (let i = 0; i < annos.length; i++) {
					const anno = annos[i]
					const data = await hlib.deleteAnnotation(anno.id, hlib.getToken())
					assertEquals(200, data.status)
					if (i + 1 === annos.length) {
						return
					}
				}
			}
			resolve(runTest())
		})
	},

	geneNameSelectionIsSuccessful: function() {
		return new Promise((resolve) => {
			async function runTest() {
				const selection = window.getSelection()
				const geneName = hlib.getById('geneName')
				geneName.style.color = 'red'
				selection.selectAllChildren(geneName)
				gather({ invoke: 'getGene()' })
				await waitSeconds(3)
				const data = await hlib.search({
					url: testUrl,
					tags: 'gene:TMEM260',
					user: testUser
				})
				const annos = data[0]
				assertEquals(1, annos.length)
				assertEquals(`["${appWindowName}","gene:TMEM260"]`, JSON.stringify(annos[0].tags))
				assertEquals('haveGene', localStorage[`${appWindowName}_state`])
			}
			resolve(runTest())
		})
	},

	monarchLookupIsSuccessful: function() {
		return new Promise((resolve) => {
			async function runTest() {
				let selection = window.getSelection()
				let hpoLookupTerm = hlib.getById('hpoLookupTerm')
				hpoLookupTerm.style.color = 'red'
				selection.selectAllChildren(hpoLookupTerm)
				gather({ invoke: 'FSM.beginMonarchLookup()' })
				await waitSeconds(2)
				assertEquals('inMonarchLookup', localStorage[`${appWindowName}_state`])
				assertEquals('truncus arteriosus', localStorage[`${appWindowName}_selection`])
				gather({ invoke: 'saveMonarchLookup()' })
				await waitSeconds(2)
				const data = await hlib.search({
					url: testUrl,
					tag: 'monarchLookup',
					user: testUser
				})
				const annos = data[0]
				assertEquals(1, annos.length)
				assertEquals(
					`["${appWindowName}","hpoLookup","monarchLookup","gene:TMEM260"]`,
					JSON.stringify(annos[0].tags)
				)
				assertEquals('haveGene', localStorage[`${appWindowName}_state`])
			}
			resolve(runTest())
		})
	},

	variantIdLookupIsSuccessful: function() {
		return new Promise((resolve) => {
			async function runTest() {
				let selection = window.getSelection()
				let variantId = hlib.getById('variantId')
				variantId.style.color = 'red'
				selection.selectAllChildren(variantId)
				gather({ invoke: 'FSM.beginVariantIdLookup()' })
				await waitSeconds(2)
				assertEquals('inVariantIdLookup', localStorage[`${appWindowName}_state`])
				assertEquals('564085', localStorage[`${appWindowName}_selection`])
				gather({ invoke: 'saveVariantIdLookup()' })
				await waitSeconds(2)
				const data = await hlib.search({
					url: testUrl,
					tag: 'variantIdLookup',
					user: testUser
				})
				const annos = data[0]
				assertEquals(2, annos.length)
				annos.forEach((anno) => {
					assertEquals(`["${appWindowName}","variantIdLookup","gene:TMEM260"]`, JSON.stringify(anno.tags))
				})
				assertEquals('haveGene', localStorage[`${appWindowName}_state`])
			}
			resolve(runTest())
		})
	},

	alleleIdLookupIsSuccessful: function() {
		return new Promise((resolve) => {
			async function runTest() {
				let selection = window.getSelection()
				let alleleId = hlib.getById('alleleId')
				alleleId.style.color = 'red'
				selection.selectAllChildren(alleleId)
				gather({ invoke: 'FSM.beginAlleleIdLookup()' })
				await waitSeconds(2)
				assertEquals('inAlleleIdLookup', localStorage[`${appWindowName}_state`])
				assertEquals('CA7200051', localStorage[`${appWindowName}_selection`])
				gather({ invoke: 'saveAlleleIdLookup()' })
				await waitSeconds(2)
				const data = await hlib.search({
					url: testUrl,
					tag: 'alleleIdLookup',
					user: testUser
				})
				const annos = data[0]
				assertEquals(2, annos.length)
				annos.forEach((anno) => {
					assertEquals(`["${appWindowName}","alleleIdLookup","gene:TMEM260"]`, JSON.stringify(anno.tags))
				})
				assertEquals('haveGene', localStorage[`${appWindowName}_state`])
			}
			resolve(runTest())
		})
  },

  cleanup: function() {
    return new Promise (resolve => {
      async function worker() {
        await cleanup()
        softReload()
        resolve()
      }
      worker()
      })
    },  

})
