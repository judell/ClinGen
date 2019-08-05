// runs in a window opened by the bookmarklet, receives messages from the host

const appWindowName = 'ClinGen'

// localStorage keys used to remember FSM state and related app state
const appStateKeys = {
  STATE: `${appWindowName}_state`,
  GENE: `${appWindowName}_gene`,
  ARTICLE_URL: `${appWindowName}_articleUrl`,
  TARGET_URI: `${appWindowName}_targetUri`,
  SELECTION: `${appWindowName}_selection`,
  PREFIX: `${appWindowName}_prefix`,
  START: `${appWindowName}_start`,
  END: `${appWindowName}_end`,
  PMID: `${appWindowName}_pmid`,
  LOOKUP_TYPE: `${appWindowName}_lookupType`,
}

const clearSelectionEvent = {
  type: "clearSelection"
}

const reloadEvent = {
  type: "reload"
}

// just public for now, can swap in the group picker as/when needed
const hypothesisGroup = '__world__'

// listen for messages from the host
window.addEventListener('message', function(event) {
  console.log(`listener event ${JSON.stringify(event)}`)
  if ( event.data === 'clearSelection' ) {
    setAppVar(appStateKeys.SELECTION, '')
    app(clearSelectionEvent)
  } else if ( event.data === `Close${appWindowName}` ) {
    window.close()
  } else if (event.data.tags && event.data.tags.indexOf(appWindowName) != -1) { 
    app(event)
  } 
})

// called with a load event initially, then with message events
async function app(event) {

  console.log(`app event type ${event.type}, data ${event.data}`)

  if (event.type==='load') {  

    // remember target_uri passed in url
    setAppVar(appStateKeys.TARGET_URI, decodeURIComponent(hlib.gup('target_uri')))

    // intialize lookup type if not already defined
    if (! getAppVar(appStateKeys.LOOKUP_TYPE)) {
      setAppVar(appStateKeys.LOOKUP_TYPE, 'individual')
    }
    
    // advance state machine to cached FSM state    
    const savedState = getAppVar(appStateKeys.STATE)
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
  } else if (event.data) {
    if (! getAppVar(appStateKeys.ARTICLE_URL)) {  
      setAppVar(appStateKeys.ARTICLE_URL, event.data.target_uri)
    }
    if (! getAppVar(appStateKeys.PMID)) {
      setAppVar(appStateKeys.PMID, event.data.pmid)
    }
    saveApiParams(event.data)  // save params for H api call
  } else if (event.type==='clearSelection') {
  // nothing specific to do here, just need a repaint
  } else if (event.type==='reload') {
  // just repaint
  }

  // used only by the test harness
  if (event.data && event.data.invoke) {
    console.log(`invoke ${JSON.stringify(event.data)}`)
    eval(event.data.invoke) 
    await hlib.delaySeconds(3)
  }  

  refreshUI()

  // app window is open, handle messages

  function isChecked(value) {
    if ( getLookupType() === value ) {
      return ' checked '
    } else {
      return ''
    }
  }

  const gene = getAppVar(appStateKeys.GENE)
  const pmid = getAppVar(appStateKeys.PMID)
  const selection = getAppVar(appStateKeys.SELECTION)
  const articleUrl = getAppVar(appStateKeys.ARTICLE_URL)
  const targetUri = getAppVar(appStateKeys.TARGET_URI)

  let lookupBoilerplate = `
    <p>
    <div>I am looking phenotypes for:
    <div><input type="radio" onchange="setLookupType()" name="lookupType" ${isChecked('individual')} value="individual"> individual </div> 
    <div><input type="radio" onchange="setLookupType()" name="lookupType" ${isChecked('group')}      value="group"> group </div>
    <div><input type="radio" onchange="setLookupType()" name="lookupType" ${isChecked('family')}     value="family"> family </div>
    </p>
    <p>You're ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${gene}+tag:hpoLookup">HPO lookups</a>,
      <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${gene}+tag:variantIdLookup">variant ID lookups</a>,
      and <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${gene}+tag:alleleIdLookup">allele ID lookups</a>`

    let hpoLookupBoilerplate = `
    <li>HPO lookup for <i>${selection}</i> in <a href="javascript:monarchLookup()">Monarch</a>
    <li>HPO lookup in <i>${selection}</i> in <a href="javascript:mseqdrLookup()">Mseqdr</a> `

  let variantLookupBoilerplate = `
    <li>Variant ID lookup for <i>${gene}</i> in <a href="javascript:variantIdLookup()">ClinVar</a>
    <li>Allele identifier lookup for <i>${gene}</i> in the <a href="javascript:alleleIdLookup()">ClinGen allele registry</a>`
    
  appendViewer(`
  <div><b>Article</b>: <a href="${articleUrl}">${articleUrl}</a></div>
  <div><b>Target URI</b>: <a href="${targetUri}">${targetUri}</a></div>
  <div><b>PMID</b>: <input id="pmid" value="${pmid}" onchange="javascript:savePmidFromInput();javascript:app(reloadEvent)"></input></div>
    <div><b>Gene</b>: ${gene}</div>
    <div><b>Selection</b>: <span class="clinGenSelection">${selection}</span></div>`
  )

  // state-dependent messages to user
  if ( FSM.state === 'needGene' && ! selection ) {
    appendViewer(`
      <p>To begin a curation, go to the window where you clicked the bookmarklet, 
      select the name of a gene, and click the ${appWindowName} button.
      </ul>`
    )
  } else if ( FSM.state === 'needGene' && selection) {
    appendViewer(`
      <p>Begin a gene curation for ${selection} in ${articleUrl}
      <p><button onclick="getGene()"> begin </button>`
    )
  } else if ( FSM.state === 'haveGene' && ! selection) {
    appendViewer(`
      ${lookupBoilerplate}
      <p>Nothing is selected in the current article.
      <p>To proceed with HPO lookups, select a term in the article, then click the ${appWindowName} ClinGen button to save the selection and continue.
      <p>Variant ID lookups and allele lookups don't depend on a selection, so you can proceed directly with those.
      <ul>
      ${variantLookupBoilerplate}
      </ul>`
    )
  } else if (FSM.state === 'haveGene' && selection) {
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
      <a href="${targetUri}">${targetUri}</a> as the Monarch lookup result for "${selection}"?
      <p><button onclick="saveMonarchLookup()">post</button>`
    )
  } else if ( FSM.state === 'inMseqdrLookup') {
    appendViewer(`
      <p>Annotate the current article with a reference to  
      <a href="${targetUri}">${targetUri}</a> as the Mseqdr lookup result for "${selection}"?
      <p><button onclick="saveMseqdrLookup()">post</button>`
    )
  } else if ( FSM.state === 'inVariantIdLookup') {
    appendViewer(`
    <p>Annotate the current article with a page note indicating the variant ID (${selection})?
    <p>(This will also annotate the lookup page with an annotation anchored to the variant ID there.)
    <p><button onclick="saveVariantIdLookup()">post</button>`
  )
  } else if ( FSM.state === 'inAlleleIdLookup') {
    appendViewer(`
      <p>Annotate the current article with a page note indicating the canonical allele ID (${selection})?
      <p>(This will also annotate the lookup page with an annotation anchored to the variant ID there.)
      <p><button onclick="saveAlleleIdLookup()">post</button>`
    )    
} else {
    console.log('unexpected state', FSM.state)
  }
}

// workflow functions

function getGene() {
  setAppVar(appStateKeys.GENE, getAppVar(appStateKeys.SELECTION))
  let params = getApiBaseParams()
  params.tags.push(`gene:${getAppVar(appStateKeys.GENE)}`)
  params.tags.push(`pmid:${getAppVar(appStateKeys.PMID)}`)
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'getGene')
}

function monarchLookup() {
  FSM.beginMonarchLookup()
  const selection = getAppVar(appStateKeys.SELECTION)
  const url = `https://monarchinitiative.org/search/${selection}`
  window.open(url, 'monarchLookup')
  window.close()
}

function mseqdrLookup() {
  FSM.beginMseqdrLookup()
  const selection = getAppVar(appStateKeys.SELECTION)
  const url = `https://mseqdr.org/search_phenotype.php?hponame=${selection}&dbsource=HPO`
  window.open(url, 'mseqdrLookup')
  window.close()
}

function addLookupTypeTag(tags) {
  const lookupType = localStorage.getItem(appStateKeys.LOOKUP_TYPE)
  if (lookupType) {
    tags.push(`phenotype:${lookupType}`)
  }
  return tags
}

function saveLookupAsPageNote(text, tags, transition) {
  tags = addLookupTypeTag(tags)
  const params = getApiBaseParams()
  const targetUri = getAppVar(appStateKeys.TARGET_URI)
  params.text = `${text}: <a href="${targetUri}">${targetUri}</a>`
  const gene = getAppVar(appStateKeys.GENE)
  params.tags = params.tags.concat(tags, `gene:${gene}`)
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, transition)
}

function saveMonarchLookup() {
  const targetUri = getAppVar(appStateKeys.TARGET_URI)
  const hpoCode = targetUri.match(/\/phenotype\/(HP.+)$/)[1]
  const hpoTag = `${hpoCode}`
  saveLookupAsPageNote('Monarch lookup result', ['hpoLookup', 'monarchLookup', hpoTag], 'saveMonarchLookup')
}

function saveMseqdrLookup() {
  const targetUri = getAppVar(appStateKeys.TARGET_URI)
  let hpoCode = targetUri.match(/\?(\d+);$/)[1]
  while (hpoCode.length < 7) { hpoCode = '0' + hpoCode }  
  const hpoTag = `HP:${hpoCode}`
  saveLookupAsPageNote('Mseqdr lookup result', ['hpoLookup', 'mseqdrLookup', hpoTag], 'saveMseqdrLookup')
}

function variantIdLookup() {
  FSM.beginVariantIdLookup()
  const gene = getAppVar(appStateKeys.GENE)
  const url = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${gene}`
  window.open(url, 'variantIdLookup')
  window.close()
}

function alleleIdLookup() {
  FSM.beginAlleleIdLookup()
  const pmid = getAppVar(appStateKeys.PMID)
  const url = `https://reg.clinicalgenome.org/redmine/projects/registry/genboree_registry/alleles?externalSource=pubmed&p1=${pmid}`
  window.open(url, 'alleleIdLookup')
  window.close()
}

async function saveLookupAsPageNoteAndAnnotation(text, tag, transition ) {
  const gene = getAppVar(appStateKeys.GENE)
  const targetUri = getAppVar(appStateKeys.TARGET_URI)
  const articleUrl = getAppVar(appStateKeys.ARTICLE_URL)
  
  let params = getApiBaseParams() 

  text = `${text} <a href="${targetUri}">${targetUri}</a>`
  const tags = params.tags.concat([`${tag}`, `gene:${gene}`])

  params.uri = targetUri
  params.text = text
  params.tags = tags
  const token = hlib.getToken()
  let payload = hlib.createAnnotationPayload(params) // save an anchored annotation to the lookup page
  const data = await hlib.postAnnotation(payload, token) 

  params = getApiBaseParamsMinusSelectors() 
  params.uri = articleUrl
  params.text = text
  params.tags = tags
  payload = hlib.createAnnotationPayload(params) // also save a page note on the current article, so omit selectors
  postAnnotationAndUpdateState(payload, token, transition)
  }

function saveVariantIdLookup() {
  saveLookupAsPageNoteAndAnnotation('ClinVar variant ID lookup result', 'variantIdLookup', 'saveVariantIdLookup')
}

function saveAlleleIdLookup() {
  saveLookupAsPageNoteAndAnnotation('ClinGen allele ID lookup result', 'alleleIdLookup', 'saveAlleleIdLookup')
  clearSelection()
}

// utility functions

function clearSelection() {
  setAppVar(appStateKeys.SELECTION, '')
}

function setAppVar(key, value) {
  localStorage.setItem(key, value)
}

function getAppVar(key) {
  return localStorage.getItem(key)
}

function setUser() {
  localStorage.setItem('h_user', document.querySelector('#userContainer input').value)
}

function getUser() {
  return localStorage.getItem('h_user')
}

function setLookupType() {
  setAppVar(appStateKeys.LOOKUP_TYPE, document.querySelector('input[name=lookupType]:checked').value)
}

function getLookupType() {
  const value = getAppVar(appStateKeys.LOOKUP_TYPE)
  return value ? value : 'individual'
}

function saveApiParams(params) {
  if (params.target_uri) {
    setAppVar(appStateKeys.TARGET_URI, params.target_uri)
  }
  if (params.exact) {
    setAppVar(appStateKeys.SELECTION, params.exact.trim())
  }
  if (params.prefix) {
    setAppVar(appStateKeys.PREFIX, params.prefix)
  }
  if (params.start) {
    setAppVar(appStateKeys.START, params.start)
  }
  if (params.end) {
    setAppVar(appStateKeys.END, params.end)
  }
}

function baseTags() {
  const tags = [appWindowName]
  return tags
}

// get base params for an annotation with selectors
function getApiBaseParams() {
  return {
    group: hypothesisGroup,
    uri: getAppVar(appStateKeys.TARGET_URI),
    exact: getAppVar(appStateKeys.SELECTION),
    prefix: getAppVar(appStateKeys.PREFIX),
    start: getAppVar(appStateKeys.START),
    end: getAppVar(appStateKeys.END),
    tags: baseTags()
    }
}

// get base params for an annotation with no selectors
function getApiBaseParamsMinusSelectors() {
  return {
    group: hypothesisGroup,
    uri: getAppVar(appStateKeys.TARGET_URI),
    tags: baseTags()
  }
}

function resetWorkflow() {
  Object.values(appStateKeys).forEach(storageKey => {
    delete localStorage[storageKey]
  });
  location.href = location.href
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

function savePmidFromInput() {
  setAppVar(appStateKeys.PMID, hlib.getById('pmid').value)
}

// post an annotation, then trigger a state transition
async function postAnnotationAndUpdateState(payload, token, transition) {
  
  function transit(transition) {
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

  clearSelection()

  transit(transition)

  writeViewer(`<p>Annotation posted.
    <div><iframe src="https://hypothes.is/a/${response.id}" width="350" height="400">
    </iframe></div>`
  )

  await hlib.delaySeconds(2)
  app(reloadEvent)
}

function refreshUI() {
  clearUI()
  refreshSvg()
  refreshHpoLookupSummary()
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

async function refreshHpoLookupSummary() {
  const gene = getAppVar(appStateKeys.GENE)
  const articleUrl = getAppVar(appStateKeys.ARTICLE_URL)
  const opts = {
    method: 'GET',
    url: `https://hypothes.is/api/search?tags=gene:${gene}&tags=hpoLookup`,
    params: {
      limit: 200
    }
  }
  const data = await hlib.httpRequest(opts)
  const rows = JSON.parse(data.response).rows
    const hpoResults = {
    individual: [],
    family: [],
    group: [],
  }

  const annos = rows.map(r => hlib.parseAnnotation(r))
  
  function filterByType(annos, type) {
    return annos.filter(a => a.tags.indexOf(`phenotype:${type}`) > -1)
  }

  function filterByHp(anno) {
    return anno.tags.filter(t => { return t.startsWith('HP:') })[0]
  }

  function reportHps(id, hps) {
    if (hps.length) {
      hlib.getById(id).innerHTML = hps.join(', ')
    }
  }

  function linkHp(id, type) {
    const gene = encodeURIComponent(`gene:${getAppVar(appStateKeys.GENE)}`)
    type = encodeURIComponent(`phenotype:${type}`)
    const text = hlib.getById(id).innerHTML
    const link = `https://hypothes.is/search?q=tag:${gene}+tag:${type}`
    const html = `<a target="_hpoAnnos" href="${link}">${text}</a>`
    hlib.getById(id).innerHTML = html
  }


  const individualAnnos = filterByType(annos, 'individual')
  const individualHps = individualAnnos.map(a => filterByHp(a))
  linkHp('hpoIndividualLabel', 'individual')
  reportHps('hpoIndividual', individualHps)
  
  const familyAnnos = filterByType(annos, 'family')
  const familyHps = familyAnnos.map(a => filterByHp(a))
  linkHp('hpoFamilyLabel', 'family')
  reportHps('hpoFamily', familyHps)  

  const groupAnnos = filterByType(annos, 'group')
  const groupHps = groupAnnos.map(a => filterByHp(a))
  linkHp('hpoGroupLabel', 'group')
  reportHps('hpoGroup', groupHps)  

}

// fsm 

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
            localStorage.setItem(appStateKeys.STATE, lifecycle.to);
            app(reloadEvent)
          }
        },
      }
    })
    return fsm
  }()
}

createFSM()

// main

hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))
const userContainer = hlib.getById('userContainer')
hlib.createFacetInputForm(userContainer, 'Hypothesis username matching API token')
userInput = userContainer.querySelector('input')
userInput.value = localStorage.getItem('h_user')
userInput.setAttribute('onchange', 'setUser()')

window.onload = app

