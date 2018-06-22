// runs from a bookmarklet, injects a relay into a host page, sends messages to the app

var ClinGenWindow;

if ( typeof ClinGenWindow === 'object' ) {
  alert('The ClinGen app is open in another window. Please use the ClinGen button in this window to continue the workflow.');
} else {
  gather()
}

function remove() {
  if (ClinGenWindow && ClinGenWindow.closed) {
    document.getElementById('activateClinGen').remove()
    gather = undefined
    ClinGenWindow = undefined
    clearInterval(intervalId)
  }
}

// if the window we opened is now closed, uninstall
var intervalId = setInterval(remove, 1000)

window.onunload = function() {
  ClinGenWindow.postMessage('CloseClinGen', '*')
}

function gather() {

  // always pass the url at which the bookmarklet activated
  var params = {
    uri: location.href,
  }

  var selection = document.getSelection()
  
  if ( selection.type==='Range' ) {
    // we have a selection to use as the target of an annotation
    // gather the selector info
    var range = selection.getRangeAt(0)

    var quoteSelector = anchoring.TextQuoteAnchor.fromRange(document.body, range)
    params.exact = quoteSelector.exact
    params.prefix = quoteSelector.prefix

    params.selection = params.exact
    
    var positionSelector = anchoring.TextPositionAnchor.fromRange(document.body, range)
    params.start = positionSelector.start
    params.end = positionSelector.end
  }

  // capture doi and pmid if available
  var metaDoi = document.head.querySelector('meta[name="citation_doi"]')
  params.doi = (metaDoi && metaDoi.content) ? metaDoi.content : undefined
  
  var metaPmid = document.head.querySelector('meta[name="citation_pmid"]')
  params.pmid = (metaPmid && metaPmid.content) ? metaPmid.content : undefined

  // common tag for all ClinGen-related annotations
  params.tags = ['ClinGen']

  // gather metadata if available
  if ( params.doi ) { params.tags.push('doi:' + params.doi) }
  if ( params.pmid ) { params.tags.push('pmid:' + params.pmid) }

  var encodedParams = encodeURIComponent(JSON.stringify(params));

  // call the app with:
  //   always: uri of page on which the bookmarklet was activated
  //   maybe: selectors for a selection on the page
  //   maybe: page metadata (doi, pmid, ...?)
  if (!ClinGenWindow) {   // open the app
    var activator = document.createElement('div')
    activator.style['position'] = 'absolute'
    activator.style['z-index'] = 999999999
    activator.innerHTML = '<button id="activateClinGen" title="Activate ClinGen workflow" onclick="gather()">ClinGen</button>'
    document.body.insertBefore(activator, document.body.firstChild)
    var opener = "width=800, height=800, toolbar=yes"
//    ClinGenWindow = window.open( `https://jonudell.info/h/ClinGen/index.html`, '_clingen', opener)
    ClinGenWindow = window.open( `https://10.0.0.9:4443/index.html`, '_clingen', opener)
  } else if (!ClinGenWindow.closed) {    // talk to the app
    ClinGenWindow.postMessage(params, '*')
  } 

}

