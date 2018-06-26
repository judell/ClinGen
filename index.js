// runs in a window opened by the bookmarklet, receives messages from the host

// localStorage keys used to remember FSM state and related app state
const storageKeys = {
  STATE: 'clingen_state',
  GENE: 'clingen_gene',
  ARTICLE: 'clingen_article',
  URL: 'clingen_url',
  SELECTION: 'clingen_selection',
  PREFIX: 'clingen_prefix',
  START: 'clingen_start',
  END: 'clingen_end',
}

// loaded from localStorage when the app loads, updated when messages arrive
const appVars = {
  GENE: undefined,
  ARTICLE: undefined,
  URL: undefined,
  SELECTION: undefined,
  PREFIX: undefined,
  START: undefined,
  END: undefined
}

const clearSelectionEvent = {
  type: "clearSelection"
}

const reloadEvent = {
  type: "reload"
}

// for message-delivered data other than appVars (e.g. pmid, doi)
var eventData = {}

const appWindowName = 'ClinGen'

// just public for now, can swap in the group picker as/when needed
const clingenGroup = '__world__'

// listen for messages from the host
window.addEventListener('message', function(event) {
  if ( event.data === 'clearSelection' ) {
    let selectionSpans = Array.prototype.slice.call(document.querySelectorAll('.clinGenSelection'))
    selectionSpans.forEach( selectionSpan => {
      selectionSpan.innerHTML = ''
      saveSelection('')
      app(clearSelectionEvent)
    })
  } else if ( event.data === 'CloseClinGen' ) {
    window.close()
  } else if (event.data.tags && event.data.tags.indexOf('ClinGen') != -1) {
    eventData = event.data // remember, e.g., the pmid and doi found in the base article
    app(event)
  }
});

// called with a load event initially, then with message events
function app(event) {

  if (event.type==='load') {   // advance state machine to cached FSM state
    let savedState = localStorage.getItem(storageKeys.STATE)
    FSM.init()
    if (savedState === 'haveGene') {
      FSM.getGene()
    } else  if (savedState === 'inMonarchLookup') {
      FSM.getGene(); FSM.beginMonarchLookup()
    } else if (savedState === 'inMseqdrLookup') {
      FSM.getGene(); FSM.beginMseqdrLookup()
    } else if (savedState === 'inClinVarLookup') {
      FSM.getGene(); FSM.beginClinVarLookup()
    } else if (savedState === 'inClinGenLookup') {
      FSM.getGene(); FSM.beginClinGenLookup()
    }
  } else if (event.type==='clearSelection') {
    // nothing specific to do here, just need a repaint
  } else if (event.type==='reload') {
    // just repaint
  } else if (event.data) {                     
    saveApiParams(event.data)  // save params for H api call
  }

  loadAppVars()   

  clearUI()

  refreshSvg()

  // app window is open, handle messages
  
  let lookupBoilerplate = `
    <p>You're ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:hpoLookup">HPO lookups</a> and/or
    <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:variantLookup">variant lookups</a>.`

  let hpoLookupBoilerplate = `
    <li>Do an HPO lookup for the selection in <a href="javascript:monarchLookup()">Monarch</a>
    <li>Do an HPO lookup for the selection in <a href="javascript:mseqdrLookup()">Mseqdr</a>`

  let variantLookupBoilerplate = `
    <li>Do a variant lookup for ${appVars.GENE} in <a href="javascript:clinVarLookup()">ClinVar</a>
    <li>Do a variant lookup for ${appVars.GENE} in <a href="javascript:clinVGenLookup()">ClinGen</a>`
    
  appendViewer(`
    <p>Current article: <a href="${appVars.ARTICLE}">${appVars.ARTICLE}</a></p>
    <p>Current gene: <b>${appVars.GENE}</b></p>
    <p>Current selection: "<span class="clinGenSelection">${appVars.SELECTION}</span>"</p>`)

  if ( FSM.state === 'needGene' && ! appVars.SELECTION ) {
    appendViewer(`
      <p>To begin a gene curation:
      <ul>
      <li>Go to an article to which you've added the ClinGen button.
      <li>Select the name of a gene.
      <li>Click the ClinGen button.
      </ul>`
    )
  } else if ( FSM.state === 'needGene' && appVars.SELECTION) {
    appendViewer(`
      <p>Begin a gene curation for <span class="clinGenSelection">${appVars.SELECTION}</span> in ${appVars.URL}
      <p><button onclick="getGene()"> begin </button>`
    )
  } else if ( FSM.state === 'haveGene' && ! appVars.SELECTION) {
    appendViewer(`
      ${lookupBoilerplate}
      <p>Nothing is selected in the current article. 
      <p>To proceed with HPO lookups, select a term in the article, then click the ClinGen button to save the selection and continue.
      <p>Variant lookups don't depend on a selection in the article, so you can proceed directly with those.
      ${variantLookupBoilerplate}`
    )
  } else if (FSM.state === 'haveGene' && appVars.SELECTION) {
    appendViewer(`
      ${lookupBoilerplate}
      <p>Your selection in the current article is "<span class="clinGenSelection">${appVars.SELECTION}</span>".  You can:
      <ul>
      ${hpoLookupBoilerplate}
      ${variantLookupBoilerplate}
      </ul>`
    )
  } else if ( FSM.state === 'inMonarchLookup') {
    appendViewer(`
      <p>Annotate the current article with a reference to 
      <a href="${appVars.URL}">${appVars.URL}</a> as the Monarch lookup result for "${appVars.SELECTION}"?
      <p><button onclick="saveMonarchLookup()">post</button>`
    )
  } else if ( FSM.state === 'inMseqdrLookup') {
    appendViewer(`
      <p>Annotate the current article with a reference to  
      <a href="${appVars.URL}">${appVars.URL}</a> as the Mseqdr lookup result for "${appVars.SELECTION}"?
      <p><button onclick="saveMseqdrLookup()">post</button>`
    )
  } else if ( FSM.state === 'inClinVarLookup') {
    appendViewer(`
      <p>Annotate the current article with ${appVars.SELECTION} as the ClinVar variant ID for ${appVars.GENE}?
      <p><button onclick="saveClinVarLookup()">post</button>`
    )
  } else if ( FSM.state === 'inClinGenLookup') {
    appendViewer(`
      <p>Annotate the current article with ${appVars.SELECTION} as the ClinGen variant ID for ${appVars.GENE}?
      <p><button onclick="saveClinGenLookup()">post</button>`
    )    
} else {
    console.log('unexpected state', FSM.state)
  }
}

// workflow functions

// helper for getGene()
function _getGene() {
  let params = getApiBaseParams()
  params.tags.push('gene:' + appVars.SELECTION)
  params.tags = params.tags.concat(getPmidAndDoi())
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'getGene')
}

// runs from postAnnotationAndUpdateState(_, _, 'getGene')
// creates a button that invovkes the _getGene helper
function getGene() {
  hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))
  hlib.createUserInputForm(hlib.getById('userContainer'))
  let params = getApiBaseParams()
  params.tags = params.tags.concat(getPmidAndDoi())
  writeViewer(`
    <div>  
      <p>Post this annotation to begin curation of <b>${appVars.SELECTION}</b>?</p>
      <pre>  ${JSON.stringify(params, null, 2)}  </pre>
    </div>`
  )
  hlib.getById('actionButton').innerHTML = `<button onclick="_getGene()">post</button>`
}

// runs from a link created in the haveGene state
function monarchLookup() {
  FSM.beginMonarchLookup()
  let url = `https://monarchinitiative.org/search/${appVars.SELECTION}`
  window.open(url, appWindowName)
  window.close()
}

// runs from a link created in the inMonarchLookup state
function saveMonarchLookup() {
  let params = getApiBaseParams()
  params.text = `Monarch lookup result: <a href="${appVars.URL}">${appVars.URL}</a>`
  params.uri = appVars.ARTICLE // because the annotation target is the article, /not/ the lookup result page
  params.tags = params.tags.concat(['hpoLookup', 'monarchLookup', `gene:${appVars.GENE}`])
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'saveMonarchLookup')
}

function mseqdrLookup() {
  FSM.beginMseqdrLookup()
  let url = `https://mseqdr.org/search_phenotype.php?hponame=${appVars.SELECTION}&dbsource=HPO`
  window.open(url, appWindowName)
  window.close()
}

// runs from a link created in the inMonarchLookup state
function saveMseqdrLookup() {
  let params = getApiBaseParams()
  params.text = `Mseqdr lookup result: <a href="${appVars.URL}">${appVars.URL}</a>`
  params.uri = appVars.ARTICLE 
  params.tags = params.tags.concat(['hpoLookup', 'mseqdrLookup', `gene:${appVars.GENE}`])
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'saveMseqdrLookup')
}

function clinVarLookup() {
  FSM.beginClinVarLookup()
  let url = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${appVars.GENE}`
  window.open(url, appWindowName)
  window.close()
}

function saveClinVarLookup() {
  let params = getApiBaseParamsMinusSelectors() // the variant id will be saved as a page note on the base article, so omit selectors
  params.text = `ClinVar lookup result: <a href="${appVars.URL}">${appVars.URL}</a>`
  params.uri = appVars.ARTICLE 
  params.tags = params.tags.concat(['variantLookup', 'clinVarLookup', `gene:${appVars.GENE}`])
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'saveClinVarLookup')
}

// utility functions

function getPmidAndDoi() {
  var tags = []
  if (eventData.pmid) {
    tags.push('pmid:'+eventData.pmid)
  }
  if (eventData.doi) {
    tags.push('doi:'+eventData.doi)
  }
  return tags
}

// save params used by h api calls to localStorage
function saveApiParams(params) {
  if (params.uri) {
    saveUrl(params.uri)
  }
  if (params.exact) {
    saveSelection(params.exact.trim())
  }
  if (params.prefix) {
    savePrefix(params.prefix)
  }
  if (params.start) {
    saveStart(params.start)
  }
  if (params.end) {
    saveEnd(params.end)
  }
}

// get base params for an annotation with selectors
function getApiBaseParams() {
  return {
    group: clingenGroup,
    username: hlib.getUser(),
    uri: appVars.URL,
    exact: appVars.SELECTION,
    prefix: appVars.PREFIX,
    start: appVars.START,
    end: appVars.END,
    tags: ['ClinGen'],
  }
}

// get base params for an annotation with no selectors
function getApiBaseParamsMinusSelectors() {
  return {
    group: clingenGroup,
    username: hlib.getUser(),
    uri: appVars.URL,
    tags: ['ClinGen'],
  }
}

// load appVars from localStorage
function loadAppVars() {
  appVars.GENE = localStorage.getItem(storageKeys.GENE)
  appVars.ARTICLE = localStorage.getItem(storageKeys.ARTICLE)
  appVars.URL = localStorage.getItem(storageKeys.URL)
  appVars.SELECTION = localStorage.getItem(storageKeys.SELECTION)
  appVars.PREFIX = localStorage.getItem(storageKeys.PREFIX)
  appVars.START = localStorage.getItem(storageKeys.START)
  appVars.END = localStorage.getItem(storageKeys.END)
}

function resetWorkflow() {
  Object.values(storageKeys).forEach(storageKey => {
    delete localStorage[storageKey]
  });
  window.close()
}

function appendViewer(str) {
  hlib.getById('viewer').innerHTML += str
}

function writeViewer(str) {
  hlib.getById('viewer').innerHTML = str
}

function  clearUI() {
  hlib.getById('viewer').innerHTML = ''
  hlib.getById('userContainer').innerHTML = ''
  hlib.getById('tokenContainer').innerHTML = ''
  hlib.getById('actionButton').innerHTML = ''
}


// save appVars to localStorage

function saveArticle(article) {
  localStorage.setItem(storageKeys.ARTICLE, article)
}

function saveGene(gene) {
  localStorage.setItem(storageKeys.GENE, gene)
}

function saveUrl(url) {
  localStorage.setItem(storageKeys.URL, url)
}

function saveSelection(selection) {
  localStorage.setItem(storageKeys.SELECTION, selection)
}

function savePrefix(prefix) {
  localStorage.setItem(storageKeys.PREFIX, prefix)
}

function saveStart(start) {
  localStorage.setItem(storageKeys.START, start)
}

function saveEnd(end) {
  localStorage.setItem(storageKeys.END, end)
}

// post an annotation, then trigger a state transition
function postAnnotationAndUpdateState(payload, token, transition) {
  
  function transit(transition) {
    if (transition==='getGene') {
      saveArticle(appVars.URL)
      saveGene(appVars.SELECTION)
      loadAppVars()
      FSM.getGene()
    } else if (transition==='saveMonarchLookup') {
      FSM.saveMonarchLookup()
    } else if (transition==='saveMseqdrLookup') {
      FSM.saveMseqdrLookup()
    } else if (transition==='saveClinVarLookup') {
      FSM.saveClinVarLookup()
    } else if (transition==='saveClinGenLookup') {
      FSM.saveClinGenLookup()
    }
    refreshSvg()
  }

  return hlib.postAnnotation(payload, token)
    .then(data => {

      var response = JSON.parse(data.response)
      if (data.status != 200) {
        alert(`hlib status ${data.status}`)
        return
      }

      clearUI()

      transit(transition)

      writeViewer(`<p>Annotation posted.
       <div><iframe src="https://hypothes.is/a/${response.id}" width="350" height="400"></iframe></div>
       <p>You can Click the ClinGen button to proceed. 
       <p>Or you can close this window to suspend the workflow for now.`
      )
    })
    .catch(e => {
      console.log(e)
    })
}

function refreshSvg() {
  let dot = StateMachineVisualize(FSM);
  dot = dot.replace('{', '{\n  rankdir=LR;')
  let opts = {
    method: 'POST',
    url: 'https://h.jonudell.info/dot',
    params: dot,
  }
  hlib.httpRequest(opts)
    .then( data => {
      hlib.getById('graph').innerHTML = data.response
      let svgTexts = Array.prototype.slice.call(document.querySelectorAll('svg text'))
      svgTexts.forEach(t => { 
        if (t.innerHTML === FSM.state) {
          t.parentElement.querySelector('ellipse').setAttribute('fill','lightgray')
        }
        // add links for clickable transitions
        if ( (t.innerHTML==='haveGene') && (FSM.state==='needGene') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.getGene();javascript:app(reloadEvent)">${t.innerHTML}</a>`
        } else if ( (t.innerHTML==='haveGene') && (FSM.state==='inMonarchLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveMonarchLookup();javascript:app(reloadEvent)">${t.innerHTML}</a>`
        } else if ( (t.innerHTML==='haveGene') && (FSM.state==='inMseqdrLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveMseqdrLookup();javascript:app(reloadEvent)">${t.innerHTML}</a>`
        } else if ( (t.innerHTML==='haveGene') && (FSM.state==='inClinVarLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveClinVarLookup();javascript:app(reloadEvent)">${t.innerHTML}</a>`
        } else if ( (t.innerHTML==='haveGene') && (FSM.state==='inClinGenLookup') ) {
        t.innerHTML = `<a xlink:href="javascript:FSM.saveClinGenLookup();javascript:app(reloadEvent)">${t.innerHTML}</a>`
      }
    })
    })
}

var FSM = function() {
  
  let fsm = new StateMachine({

    transitions: [
      { name: 'init',                   from: 'none',                 to: 'needGene'  },
      { name: 'getGene',                from: 'needGene',             to: 'haveGene'  },
      { name: 'beginMonarchLookup',     from: 'haveGene',             to: 'inMonarchLookup' },
      { name: 'saveMonarchLookup',      from: 'inMonarchLookup',      to: 'haveGene' },
      { name: 'beginMseqdrLookup',      from: 'haveGene',             to: 'inMseqdrLookup' },
      { name: 'saveMseqdrLookup',       from: 'inMseqdrLookup',       to: 'haveGene' },
      { name: 'beginClinVarLookup',     from: 'haveGene',             to: 'inClinVarLookup' },
      { name: 'saveClinVarLookup',      from: 'inClinVarLookup',      to: 'haveGene' },
      { name: 'beginClinGenLookup',     from: 'haveGene',             to: 'inClinGenLookup' },
      { name: 'saveClinGenLookup',      from: 'inClinGenLookup',      to: 'haveGene' },
    ],

    methods: {

      onEnterState: function(lifecycle) {
        console.log('entering', lifecycle.to);
        localStorage.setItem(storageKeys.STATE, lifecycle.to); // remember current state so we can return to it after a page reload
      },

    }
  })

  return fsm

}()

window.onload = app

