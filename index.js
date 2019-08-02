// runs in a window opened by the bookmarklet, receives messages from the host

const appWindowName = 'ClinGen'

// localStorage keys used to remember FSM state and related app state
const storageKeys = {
  STATE: `${appWindowName}_state`,
  GENE: `${appWindowName}_gene`,
  ARTICLE: `${appWindowName}_article`,
  URL: `${appWindowName}_url`,
  SELECTION: `${appWindowName}_selection`,
  PREFIX: `${appWindowName}_prefix`,
  START: `${appWindowName}_start`,
  END: `${appWindowName}_end`,
  PMID: `${appWindowName}_pmid`,
  DOI: `${appWindowName}_doi`,
  GROUP_PHENOTYPE: `${appWindowName}_group_phenotype`,
  FAMILY_PHENOTYPE: `${appWindowName}_family_phenotype`,
  INDIVIDUAL_PHENOTYPE: `${appWindowName}_individual_phenotype`,
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


// just public for now, can swap in the group picker as/when needed
const hypothesisGroup = '__world__'

function answer(e) {
  localStorage[`${appWindowName}_${e.name}`] = e.checked
}

// listen for messages from the host
window.addEventListener('message', function(event) {
  console.log(`listener event ${JSON.stringify(event)}`)
  if ( event.data === 'clearSelection' ) {
    saveAppVar(storageKeys.SELECTION, '')
    app(clearSelectionEvent)
  } else if ( event.data === `Close${appWindowName}` ) {
    window.close()
  } else if (event.data.tags && event.data.tags.indexOf(appWindowName) != -1) {
    eventData = event.data // remember, e.g., the pmid and doi found in the base article
    app(event)
  } 
})

function setUser() {
  localStorage.setItem('h_user', document.querySelector('#userContainer input').value)
}

function getUser() {
  return localStorage.getItem('h_user')
}

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
      <p>Let's get started. First, please tick the relevant boxes.
      <p>
      <div><input type="checkbox" onchange="answer(this)" name="groupPhenotype"</div> Will you have group phenotype info?
      <div><input type="checkbox" onchange="answer(this)" name="familyPhenotype"</div> Will you have family phenotype info?
      <div><input type="checkbox" onchange="answer(this)" name="individualPhenotype"</div> Will you have individual phenotype info?
      </p>

      <p>Then, to begin a curation, go to an article, click the ${appWindowName} bookmarklet,
      select the name of a gene, and click the ${appWindowName} button.
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
      <p>To proceed with HPO lookups, select a term in the article, then click the ${appWindowName} ClinGen button to save the selection and continue.
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
  window.open(url, 'monarchLookup')
  window.close()
}

function mseqdrLookup() {
  FSM.beginMseqdrLookup()
  let url = `https://mseqdr.org/search_phenotype.php?hponame=${appVars.SELECTION}&dbsource=HPO`
  window.open(url, 'mseqdrLookup')
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
  window.open(url, 'variantIdLookup')
  window.close()
}

function alleleIdLookup() {
  FSM.beginAlleleIdLookup()
  let url = `https://reg.clinicalgenome.org/redmine/projects/registry/genboree_registry/alleles?externalSource=pubmed&p1=${appVars.PMID}`
  window.open(url, 'alleleIdLookup')
  window.close()
}

async function saveLookupAsPageNoteAndAnnotation(text, tag, transition ) {
  var params = getApiBaseParams() // save an anchored annotation to the lookup page
  text = `${text} <a href="${appVars.URL}">${appVars.URL}</a>`
  const tags = params.tags.concat([`${tag}`, `gene:${appVars.GENE}`])
  params.text = text
  params.tags = tags
  const token = hlib.getToken()
  let payload = hlib.createAnnotationPayload(params)
  const data = await hlib.postAnnotation(payload, token)
  params = getApiBaseParamsMinusSelectors() // also save a page note on the base article, so omit selectors
  params.text = text
  params.tags = tags
  params.uri = appVars.ARTICLE
  payload = hlib.createAnnotationPayload(params)
  postAnnotationAndUpdateState(payload, token, transition)
  }

function saveVariantIdLookup() {
  saveLookupAsPageNoteAndAnnotation('ClinVar variant ID lookup result', 'variantIdLookup', 'saveVariantIdLookup')
}

function saveAlleleIdLookup() {
  saveLookupAsPageNoteAndAnnotation('ClinGen allele ID lookup result', 'alleleIdLookup', 'saveAlleleIdLookup')
}

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

// save params used by h api calls
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
    group: hypothesisGroup,
    uri: appVars.URL,
    exact: appVars.SELECTION,
    prefix: appVars.PREFIX,
    start: appVars.START,
    end: appVars.END,
    tags: [appWindowName],
  }
}

// get base params for an annotation with no selectors
function getApiBaseParamsMinusSelectors() {
  return {
    group: hypothesisGroup,
    uri: appVars.URL,
    tags: [appWindowName],
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
async function postAnnotationAndUpdateState(payload, token, transition) {
  
  function transit(transition) {
    if (transition === 'getGene') {
      saveAppVar(storageKeys.ARTICLE,appVars.URL)
      saveAppVar(storageKeys.GENE, appVars.SELECTION)
      loadAppVars()
    }
    eval(`FSM.${transition}()`)
    refreshUI()
  }

  const data = await hlib.postAnnotation(payload, token)
  if (data.status != 200) {
    alert(`hlib status ${data.status}`)
    return
  }
  const response = JSON.parse(data.response)  

  clearUI()

  transit(transition)

  writeViewer(`<p>Annotation posted.
    <div><iframe src="https://hypothes.is/a/${response.id}" width="350" height="400">
    </iframe></div>`
  )

  await hlib.delaySeconds(1)
  location.href = location.href
}

function refreshUI() {
  clearUI()
  refreshSvg()
  refreshAnnotationSummary()
}

async function refreshSvg() {
  let dot = StateMachineVisualize(FSM);
  dot = dot.replace('{', '{\n  rankdir=LR;') // use horizontal layout
  const opts = {
    method: 'POST',
    url: 'https://h.jonudell.info/dot',
    params: dot,
  }
  const data = await hlib.httpRequest(opts)
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
}

async function refreshAnnotationSummary() {
  const opts = {
    method: 'GET',
    url: `https://hypothes.is/api/search?uri=${appVars.ARTICLE}&tags=gene:${appVars.GENE}`,
    params: {
      limit: 200
    }
  }
  const data = await hlib.httpRequest(opts)
  const rows = JSON.parse(data.response).rows
  let output = `<p>Annotations for ${appVars.GENE}: ${rows.length}</p>`
  rows.forEach(row =>{
    let anno = hlib.parseAnnotation(row)
    output += hlib.showAnnotation(anno, 0, 'https://hypothes.is/search?q=tag:')
  })
  hlib.getById('annotations').innerHTML = output
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
const userContainer = hlib.getById('userContainer')
hlib.createFacetInputForm(userContainer, 'Hypothesis username matching API token')
userInput = userContainer.querySelector('input')
userInput.value = localStorage.getItem('h_user')
userInput.setAttribute('onchange', 'setUser()')

window.onload = app

