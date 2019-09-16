// inspired by https://github.com/joewalnes/jstinytest
// promisified for this project

const green = '#99ff99'

const red = '#ff9999'

let testName

const testUser = 'judell'

const testUrl = 'http://localhost:8001/test.html'

function log(msg) {
	document.getElementById('log').innerHTML += `<div>${msg}</div>`
}

function logError(msg) {
	document.getElementById('log').innerHTML += `<div style="background-color:${red}">${msg}</div>`
}

async function cleanup() {
  return new Promise(resolve => {
    async function worker() {
      const data = await hlib.search({
        wildcard_uri: testUrl + '/*',
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

		await hlib.delaySeconds(3)
		gather({ invoke: 'resetWorkflow()' })

		const testNames = Object.keys(tests)

		for (i = 0; i < testNames.length; i++) {
			const testName = testNames[i]
			log(`begin ${testName}`)
			await tests[testName]()
			await hlib.delaySeconds(5)
			log(`end ${testName}`)
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
				await hlib.delaySeconds(2)
				const selection = window.getSelection()
				const geneName = hlib.getById('geneName')
				geneName.style.color = 'red'
				selection.selectAllChildren(geneName)
				gather({ invoke: 'getGene()' })
				await hlib.delaySeconds(3)
				const data = await hlib.search({
					url: testUrl,
					tags: 'gene:TMEM260',
					user: testUser
				})
				const annos = data[0]
				assertEquals(1, annos.length)
				assertEquals(`["${appWindowName}","gene:TMEM260","pmid:30057029"]`, JSON.stringify(annos[0].tags))
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
				console.log('invoke beginMonarchLookup')
				gather({ 
					invoke: 'FSM.beginMonarchLookup()'
				})
				await hlib.delaySeconds(3)
				assertEquals('inMonarchLookup', localStorage[`${appWindowName}_state`])
				assertEquals('truncus arteriosus', localStorage[`${appWindowName}_selection`])
				gather({
					invoke: 'saveMonarchLookup()',
					testUrlSuffix: 'phenotype/HP:0001660'
				})
				await hlib.delaySeconds(3)
				gather({
					invoke: 'reportLookupClusters()'
				})
				const data = await hlib.search({
					tag: 'monarchLookup',
					user: testUser
				})
				const annos = data[0]
				assertEquals(
					`["${appWindowName}","hpoLookup","monarchLookup","HP:0001660","hpoLookup:individual","individual:1","gene:TMEM260"]`,
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
				await hlib.delaySeconds(2)
				assertEquals('inVariantIdLookup', localStorage[`${appWindowName}_state`])
				gather({
					invoke: 'saveVariantIdLookup()',
					testUrlSuffix: '/variation/426075/'
				})
				await hlib.delaySeconds(2)
				gather({
					invoke: 'reportLookupClusters()'
				})
				const data = await hlib.search({
					url: testUrl,
					tag: 'variantLookup',
					user: testUser
				})
				const annos = data[0]
				assertEquals(1, annos.length)
				const anno = annos[0]
  			assertEquals(`["${appWindowName}","variantLookup","variant:426075","variantLookup:individual","individual:1","gene:TMEM260"]`, JSON.stringify(anno.tags))
				assertEquals('haveGene', localStorage[`${appWindowName}_state`])
			}
			resolve(runTest())
		})
	},
	
})
