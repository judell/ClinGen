// runs from a bookmarklet, injects a relay into a host page, sends messages to the app

var appWindowName 

if (! appWindowName) {
  appWindowName = 'ClinGen'
}

var appWindow

// when there's a selection, move the activator button to it
document.addEventListener('mouseup', e => {
  let activator = hlib.getById('activator')
  if (document.getSelection().type==='Range' && e.target.tagName !== 'BUTTON') {
    activator.style.left = `${e.pageX}px`
    activator.style.top = `${e.pageY}px`
  } else {
    activator.style.left = 0
    activator.style.top = 0
    appWindow.postMessage('clearSelection', '*')
  }

})

if ( typeof appWindow === 'object' ) {
  alert(`The ${appWindowName} app is open in another window. Please use the ${appWindowName} button in this window to continue the workflow.`);
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

window.onunload = function() {
  appWindow.postMessage(`Close{$appWindowName}`, '*')
}

function hgvs() {
  let selection = window.getSelection().toString()
  window.open( `https://reg.clinicalgenome.org/redmine/projects/registry/genboree_registry/allele?hgvs=${selection}`, 'hgvs')
}

function gather(testArgs) {

  // always pass the url at which the bookmarklet activated
  let params = {
    uri: location.href,
  }

  let selection = document.getSelection()
  
  if ( selection.type==='Range' ) {
    // we have a selection to use as the target of an annotation
    // gather the selector info
    let range = selection.getRangeAt(0)

    let quoteSelector = anchoring.TextQuoteAnchor.fromRange(document.body, range)
    params.exact = quoteSelector.exact
    params.prefix = quoteSelector.prefix

    params.selection = params.exact
    
    let positionSelector = anchoring.TextPositionAnchor.fromRange(document.body, range)
    params.start = positionSelector.start
    params.end = positionSelector.end
  }

  // capture doi and pmid if available
  let metaDoi = document.head.querySelector('meta[name="citation_doi"]')
  params.doi = (metaDoi && metaDoi.content) ? metaDoi.content : undefined
  
  let metaPmid = document.head.querySelector('meta[name="citation_pmid"]')
  params.pmid = (metaPmid && metaPmid.content) ? metaPmid.content : undefined

  // common tag for all ClinGen-related annotations
  params.tags = [appWindowName]

  // gather metadata if available
  if ( params.doi ) { params.tags.push('doi:' + params.doi) }
  if ( params.pmid ) { params.tags.push('pmid:' + params.pmid) }

  let encodedParams = encodeURIComponent(JSON.stringify(params));

  // call the app with:
  //   always: uri of page on which the bookmarklet was activated
  //   maybe: selectors for a selection on the page
  //   maybe: page metadata (doi, pmid, ...?)
  if (!appWindow) {   // open the app
    let activator = document.createElement('div')
    activator.id = 'activator'
    activator.style['position'] = 'absolute'
    activator.style['z-index'] = 999999999
    activator.style['top'] = 0
    activator.style['left'] = 0
    activator.innerHTML = `
    <button title="Invoke ${appWindowName}" onclick="gather()">${appWindowName}</button>
    <button title="Do HGVS lookup" onclick="hgvs()">HGVS</button>`
    document.body.insertBefore(activator, document.body.firstChild)
    let opener = `width=700,height=900,top=${window.screenTop},left=${window.screenLeft + window.innerWidth}`
    appWindow = window.open( `https://jonudell.info/h/ClinGen/index.html`, appWindowName, opener)
    //appWindow = window.open( `http://10.0.0.9:8001/index.html`, appWindowName, opener)
  } 

  if (testArgs) {
    params = Object.assign(testArgs, params)
  }

  console.log(`gather sending ${JSON.stringify(params)}`)
  setTimeout( function() {
    appWindow.postMessage(params, '*') // talk to the app
    window.getSelection().empty()
  }, 200)
}

