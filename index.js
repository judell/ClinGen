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
  PMID: 'clingen_pmid',
}

// loaded from localStorage when the app loads, updated when messages arrive
const appVars = {
  GENE: undefined,
  ARTICLE: undefined,
  URL: undefined,
  SELECTION: undefined,
  PREFIX: undefined,
  START: undefined,
  END: undefined,
  PMID: undefined,
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
  console.log(`listener event ${JSON.stringify(event)}`)
  if ( event.data === 'clearSelection' ) {
    saveAppVar(storageKeys.SELECTION, '')
    app(clearSelectionEvent)
  } else if ( event.data === 'CloseClinGen' ) {
    window.close()
  } else if (event.data.tags && event.data.tags.indexOf('ClinGen') != -1) {
    eventData = event.data // remember, e.g., the pmid and doi found in the base article
    app(event)
  } 
})

// called with a load event initially, then with message events
function app(event) {

  console.log(`app event type ${event.type}, data ${event.data}`)

  if (event.type==='load') {   // advance state machine to cached FSM state
    let savedState = localStorage.getItem(storageKeys.STATE)
    if (savedState === 'haveGene') {
      FSM.getGene()
    } else if (savedState === 'inMonarchLookup') {
      FSM.getGene(); FSM.beginMonarchLookup()
    } else if (savedState === 'inMseqdrLookup') {
      FSM.getGene(); FSM.beginMseqdrLookup()
    } else if (savedState === 'inVariantIdLookup') {
      FSM.getGene(); FSM.beginVariantIdLookup()
    } else if (savedState === 'inAlleleIdLookup') {
      FSM.getGene(); FSM.beginAlleleIdLookup()
    }
  } else if (event.type==='clearSelection') {
    // nothing specific to do here, just need a repaint
  } else if (event.type==='reload') {
    // just repaint
  } else if (event.data) {                     
    saveApiParams(event.data)  // save params for H api call
  }

  loadAppVars()
  
  if (event.data && event.data.invoke) {
    eval(event.data.invoke)
  }  

  refreshUI()

  // app window is open, handle messages
  
  let lookupBoilerplate = `
    <p>You're ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:hpoLookup">HPO lookups</a>,
      <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:variantIdLookup">variant ID lookups</a>,
      and <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:alleleIdLookup">allele ID lookups</a>`

  let hpoLookupBoilerplate = `
    <li>Look up the selection in <a href="javascript:monarchLookup()">Monarch</a>
    <li>Look up the selection in <a href="javascript:mseqdrLookup()">Mseqdr</a>`

  let variantLookupBoilerplate = `
    <li>Find the ClinVar variant ID for ${appVars.GENE} in <a href="javascript:variantIdLookup()">ClinVar</a>
    <li>Find the canonical allele identifier for ${appVars.GENE} in the <a href="javascript:alleleIdLookup()">ClinGen allele registry</a>`
    
  appendViewer(`
    <div><b>Article</b>: <a href="${appVars.ARTICLE}">${appVars.ARTICLE}</a></div>
    <div><b>PMID</b>: <input id="pmid" value="${appVars.PMID}" onchange="javascript:savePmidFromInput();javascript:app(reloadEvent)"></input></div>
    <div><b>Gene</b>: ${appVars.GENE}</div>
    <div><b>URL</b>: ${appVars.URL}</div>
    <div><b>Selection</b>: "<span class="clinGenSelection">${appVars.SELECTION}</span>"</div>`
  )

  // state-dependent messages to user
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
      <p>Variant ID lookups and allele lookups don't depend on a selection in the article, so you can proceed directly with those.
      ${variantLookupBoilerplate}`
    )
  } else if (FSM.state === 'haveGene' && appVars.SELECTION) {
    appendViewer(`
      ${lookupBoilerplate}
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
  } else if ( FSM.state === 'inVariantIdLookup') {
    appendViewer(`
    <p>Annotate the current article with a page note indicating the variant ID (${appVars.SELECTION})?
    <p>(This will also annotate the lookup page with an annotation anchored to the variant ID there.)
    <p><button onclick="saveVariantIdLookup()">post</button>`
  )
  } else if ( FSM.state === 'inAlleleIdLookup') {
    appendViewer(`
      <p>Annotate the current article with a page note indicating the canonoical allele ID (${appVars.SELECTION})?
      <p>(This will also annotate the lookup page with an annotation anchored to the variant ID there.)
      <p><button onclick="saveAlleleIdLookup()">post</button>`
    )    
} else {
    console.log('unexpected state', FSM.state)
  }
}

// workflow functions

function getGene() {
  let params = getApiBaseParams()
  params.tags.push('gene:' + appVars.SELECTION)
  params.tags = params.tags.concat(getPmidAndDoi())
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'getGene')
}

function monarchLookup() {
  FSM.beginMonarchLookup()
  let url = `https://monarchinitiative.org/search/${appVars.SELECTION}`
  window.open(url, appWindowName)
  window.close()
}

function mseqdrLookup() {
  FSM.beginMseqdrLookup()
  let url = `https://mseqdr.org/search_phenotype.php?hponame=${appVars.SELECTION}&dbsource=HPO`
  window.open(url, appWindowName)
  window.close()
}

function saveLookupAsPageNote(text, tags, transition) {
  let params = getApiBaseParams()
  params.text = `${text}: <a href="${appVars.URL}">${appVars.URL}</a>`
  params.uri = appVars.ARTICLE 
  params.tags = params.tags.concat(tags, `gene:${appVars.GENE}`)
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, transition)
}

function saveMonarchLookup() {
  saveLookupAsPageNote('Monarch lookup result', ['hpoLookup', 'monarchLookup'], 'saveMonarchLookup')
}

function saveMseqdrLookup() {
  saveLookupAsPageNote('Mseqdr lookup result', ['hpoLookup', 'mseqdrLookup'], 'saveMseqdrLookup')
}

function variantIdLookup() {
  FSM.beginVariantIdLookup()
  let url = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${appVars.GENE}`
  window.open(url, appWindowName)
  window.close()
}

function alleleIdLookup() {
  FSM.beginAlleleIdLookup()
  let url = `https://reg.clinicalgenome.org/redmine/projects/registry/genboree_registry/alleles?externalSource=pubmed&p1=${appVars.PMID}`
  window.open(url, appWindowName)
  window.close()
}

function saveLookupAsPageNoteAndAnnotation(text, tag, transition ) {
  var params = getApiBaseParams() // save an anchored annotation to the lookup page
  text = `${text} <a href="${appVars.URL}">${appVars.URL}</a>`
  const tags = params.tags.concat([`${tag}`, `gene:${appVars.GENE}`])
  params.text = text
  params.tags = tags
  const token = hlib.getToken()
  let payload = hlib.createAnnotationPayload(params)
  hlib.postAnnotation(payload, token)
    .then( data => {
      params = getApiBaseParamsMinusSelectors() // also save a page note on the base article, so omit selectors
      params.text = text
      params.tags = tags
      params.uri = appVars.ARTICLE
      payload = hlib.createAnnotationPayload(params)
      postAnnotationAndUpdateState(payload, token, transition)
    })
  }

function saveVariantIdLookup() {
  saveLookupAsPageNoteAndAnnotation('ClinVar variant ID lookup result', 'variantIdLookup', 'saveVariantIdLookup')
}

function saveAlleleIdLookup() {
  saveLookupAsPageNoteAndAnnotation('ClinGen allele ID lookup result', 'alleleIdLookup', 'saveAlleleIdLookup')
}

// utility functions

function getPmidAndDoi() {
  var tags = []
  let pmid = eventData.pmid
  if (pmid) {
    tags.push('pmid:' + pmid)
    savePmid(pmid)
  }
  if (eventData.doi) {
    tags.push('doi:'+eventData.doi)
  }
  return tags
}

// save params used by h api calls to localStorage
function saveApiParams(params) {
  if (params.uri) {
    saveAppVar(storageKeys.URL, params.uri)
  }
  if (params.exact) {
    saveAppVar(storageKeys.SELECTION, params.exact.trim())
  }
  if (params.prefix) {
    saveAppVar(storageKeys.PREFIX, params.prefix)
  }
  if (params.start) {
    saveAppVar(storageKeys.START, params.start)
  }
  if (params.end) {
    saveAppVar(storageKeys.END, params.end)
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
  appVars.PMID = localStorage.getItem(storageKeys.PMID)
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

function clearUI() {
  hlib.getById('viewer').innerHTML = ''
  hlib.getById('userContainer').innerHTML = ''
  hlib.getById('tokenContainer').innerHTML = ''
  hlib.getById('actionButton').innerHTML = ''
}

// save appVars to localStorage

function saveAppVar(key, value) {
  localStorage.setItem(key, value)
}

function savePmid(pmid) {
  saveAppVar(storageKeys.PMID, pmid)
}

function savePmidFromInput() {
  savePmid(hlib.getById(storageKeys.PMID).value)
}

// post an annotation, then trigger a state transition
/*
Note: Would rather just pass the FSM method here, not a stringified name,
but when trying to call it in the then clause, this happens:

TypeError: Cannot read property '_fsm' of undefined
    at target.(anonymous function) (https://jonudell.info/hlib/state-machine.js:624:19)
    at transit (index.js:405)
    at hlib.postAnnotation.then.data (index.js:429)

The abstraction is somewhat leaky.

Eval might work, but better not to go there.

Unfortunately that makes this one of several places in the code that need 
updating when the workflow changes. I'm looking for ways to consolidate the
duplication because it makes writing a workflow app harder than it needs to be.

If this whole approach pans out, it might be worth making a generator for the
`transit` method.
*/
function postAnnotationAndUpdateState(payload, token, transition) {
  
  function transit(transition) {
    if (transition==='getGene') {
      FSM.getGene()
      saveAppVar(storageKeys.ARTICLE,appVars.URL)
      saveAppVar(storageKeys.GENE, appVars.SELECTION)
      loadAppVars()
    } else if (transition==='saveMonarchLookup') {
      FSM.saveMonarchLookup()
    } else if (transition==='saveMseqdrLookup') {
      FSM.saveMseqdrLookup()
    } else if (transition==='saveVariantIdLookup') {
      FSM.saveVariantIdLookup()
    } else if (transition==='saveAlleleIdLookup') {
      FSM.saveAlleleIdLookup()
    }
    refreshUI()
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
       <p>You can click the ClinGen button to proceed. 
       <p>Or you can close this window to suspend the workflow, and relaunch ClinGen when ready to proceed.`
      )

      refreshSvg()
    })
    .catch(e => {
      console.log(e)
    })
}

function refreshUI() {
  clearUI()
  refreshSvg()
  refreshAnnotationSummary()
}

function refreshSvg() {
  let dot = StateMachineVisualize(FSM);
  dot = dot.replace('{', '{\n  rankdir=LR;') // use horizontal layout
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
        // Add links for clickable transitions.
        // This is another section that can need attention when the state diagram changes, 
        // and might benefit from a generator.
        if ( (t.innerHTML==='haveGene') && (FSM.state==='inMonarchLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveMonarchLookup()">${t.innerHTML}</a>`
        } else if ( (t.innerHTML==='haveGene') && (FSM.state==='inMseqdrLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveMseqdrLookup()">${t.innerHTML}</a>`
        } else if ( (t.innerHTML==='haveGene') && (FSM.state==='inVariantIdLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveVariantIdLookup()">${t.innerHTML}</a>`
        } else if ( (t.innerHTML==='haveGene') && (FSM.state==='inAlleleIdLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveAlleleIdLookup()">${t.innerHTML}</a>`
      }
    })
  })
}

function refreshAnnotationSummary() {
  let opts = {
    method: 'GET',
    url: `https://hypothes.is/api/search?uri=${appVars.ARTICLE}&tags=gene:${appVars.GENE}`,
    params: {
      limit: 200
    }
  }
  hlib.httpRequest(opts)
    .then( data => {
      let rows = JSON.parse(data.response).rows
      let output = `<p>Annotations for ${appVars.GENE}: ${rows.length}</p>`
      rows.forEach(row =>{
        let anno = hlib.parseAnnotation(row)
        output += hlib.showAnnotation(anno, 0, 'https://hypothes.is/search?q=tag:')
      })
      hlib.getById('annotations').innerHTML = output
    })
}

var FSM

function createFSM() {
  FSM = function() {
    let fsm = new StateMachine({
      init: 'needGene',
      transitions: [
        { name: 'getGene',                from: 'needGene',             to: 'haveGene'  },
        { name: 'beginMonarchLookup',     from: 'haveGene',             to: 'inMonarchLookup' },
        { name: 'saveMonarchLookup',      from: 'inMonarchLookup',      to: 'haveGene' },
        { name: 'beginMseqdrLookup',      from: 'haveGene',             to: 'inMseqdrLookup' },
        { name: 'saveMseqdrLookup',       from: 'inMseqdrLookup',       to: 'haveGene' },
        { name: 'beginVariantIdLookup',   from: 'haveGene',             to: 'inVariantIdLookup' },
        { name: 'saveVariantIdLookup',    from: 'inVariantIdLookup',    to: 'haveGene' },
        { name: 'beginAlleleIdLookup',    from: 'haveGene',             to: 'inAlleleIdLookup' },
        { name: 'saveAlleleIdLookup',     from: 'inAlleleIdLookup',     to: 'haveGene' },
      ],
      methods: {
        onEnterState: function(lifecycle) {
          console.log('entering', lifecycle.to);
          if (lifecycle.to !== 'needGene') {
            localStorage.setItem(storageKeys.STATE, lifecycle.to);
            app(reloadEvent)
          }
        },
      }
    })
    return fsm
  }()
}

createFSM()
hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))
hlib.createUserInputForm(hlib.getById('userContainer'))
window.onload = app

