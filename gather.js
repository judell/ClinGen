// runs from a bookmarklet, injects a relay into a host page, sends messages to the app

var appWindowName 

if (! appWindowName) {
  appWindowName = 'ClinGen'
} 

var appWindow

params = {}

// when there's a selection, move the activator button to it
document.addEventListener('mouseup', e => {
  const activator = hlib.getById('activator')
  if (document.getSelection().type==='Range' && e.target.tagName !== 'BUTTON') {
    activator.style.left = `${e.pageX}px`
    activator.style.top = `${e.pageY}px`
    activator.style.display = 'block'
  } else {
    activator.style.left = 0
    activator.style.top = 0
    activator.style.display = 'none'
    appWindow.postMessage('clearSelection', '*')
  }

})

if ( typeof appWindow === 'object' ) {
  alert(`The ${appWindowName} app is already running.`);
} else {
  gather()
}

function remove() {
  if (appWindow && appWindow.closed) {
    document.getElementById('activator').remove()
    gather = undefined
    appWindow = undefined
    clearInterval(intervalId)
    window.getSelection().empty()
  }
}

// if the window we opened is now closed, uninstall
var intervalId = setInterval(remove, 1000)

window.onbeforeunload = function() {
  if (appWindow) {
    appWindow.postMessage(`Close${appWindowName}`, '*')
  }
}

window.onunload = function() {
  if (appWindow) {
    appWindow.postMessage(`Close${appWindowName}`, '*')
  }
}

function hgvs() {
  const selection = window.getSelection().toString()
  window.open( `https://reg.clinicalgenome.org/redmine/projects/registry/genboree_registry/allele?hgvs=${selection}`, 'hgvs')
}

function gather(testArgs) {

  // always pass the url at which the bookmarklet activated
  // call it target_uri because it will be the target of annotations,
  // either on the paper being curated, or on lookup pages elsewhere, or both

  console.log(`gather testArgs ${JSON.stringify(testArgs)}`)

  const selection = document.getSelection()
  
  if ( selection.type==='Range' ) {
    // we have a selection to use as the target of an annotation
    // gather the selector info
    const range = selection.getRangeAt(0)

    const quoteSelector = anchoring.TextQuoteAnchor.fromRange(document.body, range)
    params.exact = quoteSelector.exact
    params.prefix = quoteSelector.prefix

    params.selection = params.exact
    
    const positionSelector = anchoring.TextPositionAnchor.fromRange(document.body, range)
    params.start = positionSelector.start
    params.end = positionSelector.end
  }

  const metaPmid = document.head.querySelector('meta[name="citation_pmid"]')
  const pmid = (metaPmid && metaPmid.content) ? metaPmid.content : undefined
  params.pmid = pmid

  // common tag for all ClinGen-related annotations
  params.tags = [appWindowName]

  // gather metadata if available
    if ( params.pmid ) { params.tags.push('pmid:' + params.pmid) }

  // call the app with:
  //   always: uri of page on which the bookmarklet was activated
  //   maybe: selectors for a selection on the page
  //   maybe: page metadata (doi, pmid, ...?)
  if (!appWindow) {   // open the app
    let activator = document.createElement('div')
    activator.id = 'activator'
    activator.style.position = 'absolute'
    activator.style.zIndex = 999999999
    activator.style.top = 0
    activator.style.left = 0
    activator.style.display = 'none'
    activator.innerHTML = `
    <button title="Invoke ${appWindowName}" onclick="gather()">${appWindowName}</button>
    <button title="Do HGVS lookup" onclick="hgvs()">HGVS</button>`
    document.body.insertBefore(activator, document.body.firstChild)
    let opener = `width=700,height=900,top=${window.screenTop},left=${window.screenLeft + window.innerWidth}`
    const target_uri = encodeURIComponent(location.href)
    appWindow = window.open( `https://jonudell.info/h/ClinGen/index.html?target_uri=${target_uri}`, appWindowName, opener)
    //appWindow = window.open( `http://localhost:8001/index.html?target_uri=${target_uri}`, appWindowName, opener)
  } 

  params.target_uri = location.href

  if (testArgs) {
    if (testArgs.invoke) {
      params.invoke = testArgs.invoke
    }
    if (testArgs.target_uri) {
      params.target_uri = testArgs.target_uri
    }
  }
  
  console.log(`gather sending ${JSON.stringify(params)}`)
  setTimeout( function() {
    appWindow.postMessage(params, '*') // talk to the app
    window.getSelection().empty()
  }, 200)
}

