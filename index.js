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
  LOOKUP_INSTANCE_INDIVIDUAL: `${appWindowName}_lookupInstanceIndividual`,
  LOOKUP_INSTANCE_FAMILY: `${appWindowName}_lookupInstanceFamily`,
  LOOKUP_INSTANCE_GROUP: `${appWindowName}_lookupInstanceGroup`,
}

const lookupTags = ['hpoLookup', 'variantLookup', 'alleleLookup']
const lookupTypes = ['individual', 'family', 'group']

// just public for now, can swap in the group picker as/when needed
const hypothesisGroup = '__world__'

// listen for messages from the host
window.addEventListener('message', function(event) {
  if ( event.data === `Close${appWindowName}` ) {
    window.close()
  } else if (event.data.tags && event.data.tags.indexOf(appWindowName) != -1) { 
    app(event)
  } 
})

async function app(event) {

  if (event.advanceToSavedState) {
    advanceToSavedState()
    reportLookupClusters()
  }
  
  // remember target_uri passed in url
  setAppVar(appStateKeys.TARGET_URI, decodeURIComponent(hlib.gup('target_uri')))

  // remember the selection if passed in event.data
  if (event.data && event.data.hasOwnProperty('selection')) {
    setAppVar(appStateKeys.SELECTION, event.data.selection)
  }

  // intialize appvars not already defined
  if (! getAppVar(appStateKeys.LOOKUP_TYPE)) {
    setAppVar(appStateKeys.LOOKUP_TYPE, 'individual')
  }

  if (event.data) {
    saveApiParams(event.data)   // save params for H api call 
   
    // when target_uri is a message param, it represents the article url
    if (! getAppVar(appStateKeys.ARTICLE_URL && event.data.target_uri)) { 
      setAppVar(appStateKeys.ARTICLE_URL, event.data.target_uri)
    }

    // set pmid if passed in event data
    if (! getAppVar(appStateKeys.PMID && event.data.pmid)) {
      setAppVar(appStateKeys.PMID, event.data.pmid)
    }
    // used only by the test harness    
    if (event.data.invoke) { 
      console.log(`invoke ${JSON.stringify(event.data)}`)
      const url = location.href
      if (event.data.testUrlSuffix) {
        history.pushState(null, '', `${url}/${event.data.testUrlSuffix}`)
      }
      eval(event.data.invoke) 
      history.pushState(null, '', url)
      await hlib.delaySeconds(3)
    }
  }

  refreshUI()

  // app window is open, handle messages
  const gene = getAppVar(appStateKeys.GENE)
  const pmid = getAppVar(appStateKeys.PMID)
  const selection = getAppVar(appStateKeys.SELECTION)
  const articleUrl = getAppVar(appStateKeys.ARTICLE_URL)
  const targetUri = getAppVar(appStateKeys.TARGET_URI)
  const lookupType = getLookupType()
  const lookupInstance = getLookupInstance(lookupType)
  const lookupTemplate = `
    <p>Ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${gene}+tag:hpoLookup">HPO lookups</a>,
      <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${gene}+tag:variantIdLookup">variant ID lookups</a>,
      and <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${gene}+tag:alleleIdLookup">allele ID lookups</a>.
    `
  
  const hpoLookupTemplate = `
    <li>HPO lookup for <i>${selection}</i> in <a href="javascript:monarchLookup()">Monarch</a>
    <li>HPO lookup in <i>${selection}</i> in <a href="javascript:mseqdrLookup()">Mseqdr</a> `

  const hpoLookupTemplate2 = `
    <p>Annotate the current article with a reference to 
    <a href="${targetUri}">${targetUri}</a> as the lookup result for "${selection}" 
    (${lookupType} ${lookupInstance})?`
  
  const variantLookupTemplate = `
    <li>Variant ID lookup for <i>${gene}</i> in <a href="javascript:variantIdLookup()">ClinVar</a>
    <li>Allele identifier lookup for <i>${gene}</i> in the <a href="javascript:alleleIdLookup()">ClinGen allele registry</a>`
    
  const articleContext = `
    <div><b>Article</b>: <a href="${articleUrl}">${articleUrl}</a></div>
    <div><b>Target URI</b>: <a href="${targetUri}">${targetUri}</a></div>
    <div><b>Gene</b>: ${gene}</div>
    <div><b>Selection</b>: <span class="clinGenSelection">${selection}</span></div>
    `
    
  hlib.getById('articleContext').innerHTML = articleContext

  expressStateToUX()
  
  function expressStateToUX() {
    if (FSM.state === 'needGene' && !selection) {
      appendViewer(`
      <p>To begin (or continue) a curation, go to the window where you clicked the bookmarklet, 
      select the name of a gene, and click the ${appWindowName} button.
      </ul>`);
    }
    else if (FSM.state === 'needGene' && selection) {
      appendViewer(`
      <p>Begin a gene curation for ${selection} in ${articleUrl}
      <p><button onclick="getGene()"> begin </button>`);
    }
    else if (FSM.state === 'haveGene' && !selection) {
      appendViewer(`
      ${lookupTemplate}
      <p>Nothing is selected in the current article.
      <p>To proceed with HPO lookups, select a term in the article, then click the ${appWindowName} ClinGen button to save the selection and continue.
      <p>Variant ID lookups and allele lookups don't depend on a selection, so you can proceed directly with those.
      <ul>
      ${variantLookupTemplate}
      </ul>`);
    }
    else if (FSM.state === 'haveGene' && selection) {
      appendViewer(`
      ${lookupTemplate}
      <ul>
      ${hpoLookupTemplate}
      ${variantLookupTemplate}
      </ul>`);
    }
    else if (FSM.state === 'inMonarchLookup') {
      if (launchedFromArticlePage()) {
        appendViewer(`<p>You are in a Monarch lookup, but you launched from the article page. Please click haveGene, then restart a lookup`)
      } else {
        appendViewer(`
          ${hpoLookupTemplate2}
          <p><button onclick="saveMonarchLookup()">post</button>`)
      }
    }
    else if (FSM.state === 'inMseqdrLookup') {
      if (launchedFromArticlePage()) {
        appendViewer(`<p>You are in an Mseqdr lookup, but you launched from the article page. Please click haveGene, then restart a lookup`)
      } else {
        appendViewer(`
          ${hpoLookupTemplate2}
          <p><button onclick="saveMseqdrLookup()">post</button>`)
      }
    }
    else if (FSM.state === 'inVariantIdLookup') {
      appendViewer(`
        <p>Annotate the current article with a page note indicating the variant ID 
        ${extractVariantFromUrl(getAppVar(appStateKeys.TARGET_URI))}?
        <p><button onclick="saveVariantIdLookup()">post</button>`);
    }
    else if (FSM.state === 'inAlleleIdLookup') {
      appendViewer(`
        <p>Annotate the current article with a page note indicating the canonical allele ID 
        ${extractAlleleFromUrl(getAppVar(appStateKeys.TARGET_URI))}?
        <p><button onclick="saveAlleleIdLookup()">post</button>`);
    }
    else {
      console.log('unexpected state', FSM.state);
    }
  }

}

// workflow functions

function advanceToSavedState() {
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
}    

function getGene() {
  setAppVar(appStateKeys.GENE, getAppVar(appStateKeys.SELECTION))
  let params = getApiBaseParams()
  params.tags.push(`gene:${getAppVar(appStateKeys.GENE)}`)
  params.tags.push(`pmid:${getAppVar(appStateKeys.PMID)}`)
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'getGene')
}

// lookup initiators
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

// lookup savers

function saveMonarchLookup() {
  const here = decodeURIComponent(location.href)
  const match = here.match(/\/phenotype\/(HP.+)$/)
  if (!match) {
    alert('url does not match "phenotype/HP*"')
    return
  }
  const hpoCode = match[1]
  const resultUrl = getAppVar(appStateKeys.TARGET_URI)
  const text = `Monarch lookup result: <a href="${resultUrl}">${resultUrl}</a>`
  const tags = ['hpoLookup', 'monarchLookup', hpoCode]
  const transition = 'saveMonarchLookup'
  // save an anchored annotation on the article
  saveLookup(text, tags, transition, getAppVar(appStateKeys.ARTICLE_URL), true)
}

function saveMseqdrLookup() {
  const here = decodeURIComponent(location.href)
  const match = here.match(/hpo_browser.php\?(\d+);$/)
  if (!match) {
    alert('url does not match "hpo_browser.php/*"')
    return
  }
  let hpoCode = match[1]
  while (hpoCode.length < 7) { hpoCode = '0' + hpoCode }
  hpoCode = `HP:${hpoCode}`
  const resultUrl = getAppVar(appStateKeys.TARGET_URI)
  const text = `Mseqdr lookup result: <a href="${resultUrl}">${resultUrl}</a>`
  const tags = ['hpoLookup', 'mseqdrLookup', hpoCode]
  const transition = 'saveMseqdrLookup'
  // save an anchored annotation on the article
  saveLookup(text, tags, transition, getAppVar(appStateKeys.ARTICLE_URL), true)
}

function saveVariantIdLookup() {
  const variantId = extractVariantFromUrl(location.href);
  if (variantId === 'notFound') {
    alert('url does not match "variation/*"')
    return
  }
  const resultUrl = getAppVar(appStateKeys.TARGET_URI)
  const text = `variant id lookup result: <a href="${resultUrl}">${resultUrl}</a>`
  const tags = ['variantLookup', `variant:${variantId}`]
  const transition = 'saveVariantIdLookup'
  // save a page note on the article
  saveLookup(text, tags, transition, getAppVar(appStateKeys.ARTICLE_URL), false)
}

function saveAlleleIdLookup() {
  const alleleId = extractAlleleFromUrl(location.href);
  if (alleleId === 'notFound') {
    alert('url does not match "caid=CA*"')
    return
  }
  const resultUrl = getAppVar(appStateKeys.TARGET_URI)
  const text = `allele id lookup result: <a href="${resultUrl}">${resultUrl}</a>`
  const tags = ['alleleLookup', `allele:${alleleId}`]
  const transition = 'saveAlleleIdLookup'
  // save a page note on the article
  saveLookup(text, tags, transition, getAppVar(appStateKeys.ARTICLE_URL), false)
}

// utility functions

function launchedFromArticlePage() {
  const uri = new URL(location.href)
  const search = decodeURIComponent(uri.search)
  const articleUrl = getAppVar(appStateKeys.ARTICLE_URL)
  return search.endsWith(articleUrl)
}

function extractVariantFromUrl(url) {
  url = decodeURIComponent(url)
  const match = url.match(/variation\/(\d+)/)
  return match ? match[1] : 'notFound'
}

function extractAlleleFromUrl(url) {
  url = decodeURIComponent(url)
  const match = url.match(/caid=(CA\d+)/)
  return match ? match[1] : 'notFound'
}

async function searchAnnotationsByTag(tag) {
  const gene = getAppVar(appStateKeys.GENE)
  const params = {
    tag: `gene:${gene}`,
    user: getUser()
    }
  const [rows, replies] = await hlib.search(params)
  const annos = rows.map(r => hlib.parseAnnotation(r));
  return annos;
}

async function saveLookup(text, tags, transition, targetUri, anchored) {
  const haveLookupTag = lookupTags
                          .filter(x => tags.includes(x))
                          .length > 0
  if (haveLookupTag) {
    tags = addLookupTypeAndInstanceTags(tags)
  } else {
    alert(`Expected one of these tags: ${lookupTags.join(', ')}`)
    return
  }
  const gene = getAppVar(appStateKeys.GENE)
  let annos = await searchAnnotationsByTag(`gene:${gene}`)
  for (let tag of tags) {
    annos = annos.filter(a => a.tags.indexOf(tag) > -1)  
  }
  if (annos.length) {
    alert(`There is already an annotation with the tags [${tags.join(', ')}]. Please click haveGene to retry with a different selection and/or individual/family/group.`)
    return
  }
  const params = anchored ? getApiBaseParams() : getApiBaseParamsMinusSelectors()
  params.username = getUser()
  params.uri = targetUri
  params.text = text
  params.tags = params.tags.concat(tags, `gene:${gene}`)
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, transition)
}

function addLookupTypeAndInstanceTags(tags) {
  const lookupType = localStorage.getItem(appStateKeys.LOOKUP_TYPE)
  const instanceKey = getLookupKey(lookupType)
  const instanceNum = localStorage.getItem(instanceKey)
  const lookupTarget = tags[0]
  if (lookupType) {
    tags.push(`${lookupTarget}:${lookupType}`)
    tags.push(`${lookupType}:${instanceNum}`)
  } else {
    alert(`Did not find a lookup type in ${appStateKeys.LOOKUP_TYPE}`)
  }
  return tags
}

function lookupTypeIsChecked(value) {
  if ( getLookupType() === value ) {
    return ' checked '
  } else {
    return ''
  }
}

function clearSelection() {
  setAppVar(appStateKeys.SELECTION, '')
}

function setAppVar(key, value) {
  localStorage.setItem(key, value)
}

function getAppVar(key) {
  const value = localStorage.getItem(key)
  return (typeof value !== 'undefined') ? value : null
}

function setUser() {
  localStorage.setItem('h_user', document.querySelector('#userContainer input').value)
}

function getUser() {
  return localStorage.getItem('h_user')
}

function getLookupType() {
  const value = getAppVar(appStateKeys.LOOKUP_TYPE)
  return value ? value : 'individual'
}

function getLookupKey(type) {
  let key 
  if (type === 'individual') {
    key = appStateKeys.LOOKUP_INSTANCE_INDIVIDUAL
  }
  if (type === 'family') {
    key = appStateKeys.LOOKUP_INSTANCE_FAMILY
  }
  if (type === 'group') {
    key = appStateKeys.LOOKUP_INSTANCE_GROUP    
  }
  return key
}

function setLookupInstance(type, num) {
  const key = getLookupKey(type)
  setAppVar(key, num)
}

function getLookupInstance(type) {
  const key = getLookupKey(type)
  const value = getAppVar(key)
  return value ? value : '1'
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
    tags: baseTags(),
    exact: getAppVar(appStateKeys.SELECTION),
    prefix: getAppVar(appStateKeys.PREFIX),
    start: getAppVar(appStateKeys.START),
    end: getAppVar(appStateKeys.END)
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

async function resetWorkflow() {
  const gene = getAppVar(appStateKeys.GENE)
  const user = getUser()
  if (window.confirm(`Really delete all annotations for ${gene} by ${user} and erase remembered settings for this curation?`)) {
    const [annotations, replies] = await hlib.search({
      user: user,
      tag: `gene:${gene}`
    })
    for (annotation of annotations) {
      hlib.deleteAnnotation(annotation.id)
    }
    const keys = Object.values(appStateKeys)
    for (let key of keys) {
      delete localStorage[key]
      if (key.indexOf('lookupInstance') != -1) {
        setAppVar(key, '1')
      }
    }
    location.href = location.href
  }
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

// post an annotation, then trigger a state transition
async function postAnnotationAndUpdateState(payload, token, transition) {
  
  function transit(transition) {
    eval(`FSM.${transition}()`)
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
    <div><iframe src="https://hypothes.is/a/${response.id}" width="350" height="300">
    </iframe></div>`
  )

  await hlib.delaySeconds(3)

  if (location.href.startsWith('http://localhost')) {
    app({advanceToSavedState:false})
  } else {
  window.close()
  }

}

function refreshUI() {
  clearUI()
  refreshSvg()
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

function reportLookupClusters() {
  hlib.getById('individualResults').innerHTML = ''
  for (lookupType of lookupTypes) {
    reportLookupCluster(lookupType, 'hpoLookup', 'HP:')
    reportLookupCluster(lookupType, 'variantLookup', 'variant:')
  }
}

async function reportLookupCluster(type, tag, namespace) {
  const annos = await searchAnnotationsByTag(tag)
  
  function filterAnnosByLookupType(annos, type) {
    return annos.filter(a => a.tags.indexOf(`${tag}:${type}`) > -1)
  }

  function organizeLookupsByInstanceType(annos, type, namespace) {
    const values = {}
    for (anno of annos) {
      const instanceTag = anno.tags.filter(t => { return t.startsWith(`${type}:`) })[0]
      const value = anno.tags.filter(t => { return t.startsWith(namespace) })[0]
      if (values[instanceTag]) {
        values[instanceTag].push(value)
      } else {
        values[instanceTag] = [value]
      }
    }
    return values
  }

  function reportLookupValues(type, values) {
    const keys = Object.keys(values).sort()
    let html = ''
    for (let key of keys) {
      html += `<div>${key} ${values[key].join(', ')}</div>`
    }
    const elementId = `${type}Results`
    hlib.getById(elementId).innerHTML += html
  }

  function linkLookupTypes(id, type) {
    const gene = encodeURIComponent(`gene:${getAppVar(appStateKeys.GENE)}`)
    type = encodeURIComponent(`phenotype:${type}`)
    const text = hlib.getById(id).innerHTML
    const link = `https://hypothes.is/search?q=tag:${gene}+tag:${type}`
    const html = `<a target="_hpoAnnos" href="${link}">${text}</a>`
    hlib.getById(id).innerHTML = html
  }

  function _reportLookupCluster(type, namespace, annos) {
    const clusterAnnos = filterAnnosByLookupType(annos, type)
    const values = organizeLookupsByInstanceType(clusterAnnos, type, namespace)
    //linkLookupTypes(linkId, type)
    reportLookupValues(type, values)
  }

  _reportLookupCluster(type, namespace, annos)
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
          console.log('entering', lifecycle.to)
          if (lifecycle.to !== 'needGene') {
            localStorage.setItem(appStateKeys.STATE, lifecycle.to)
            app({advanceToSavedState:false})
          }
        },
      }
    })
    return fsm
  }()
}

createFSM()

// custom elements

class LabeledIntegerSelect extends HTMLElement {
  type
  count
  constructor() {
    super()
  }
  connectedCallback() {
    this.type = this.getAttribute('type')
    this.count = this.getAttribute('count')
    this.innerHTML = `
      <span class="integer-select-type">${this.type}</span>
      <select is="integer-select" type="${this.type}" count="${this.count}"></select>
      `
  }
}
customElements.define('labeled-integer-select', LabeledIntegerSelect)

class LabeledIntegerSelectCollection extends HTMLElement {
  static handler(e) {
    console.log(JSON.stringify(e.detail))
    // downside of using a static method to export this handler: can only have one of these elements in the document
    const element = document.querySelector('labeled-integer-select-collection') 
    const integerSelects = Array.from(element.querySelectorAll('labeled-integer-select'))
    for (let integerSelect of integerSelects) {
      const label = integerSelect.querySelector('.integer-select-type')
      if (label.innerText === e.detail.type) {
        label.setAttribute('selected', true)
        label.style.fontWeight = 'bold'
      } else {
        label.removeAttribute('selected')
        label.style.fontWeight = 'normal'
      }
    }
  }
  constructor() {
    super()
    this.addEventListener('labeled-integer-select-event', LabeledIntegerSelectCollection.handler)
  }
  connectedCallback() {
    const firstLabeledIntegerSelect = this.querySelector('labeled-integer-select')
    firstLabeledIntegerSelect.setAttribute('selected', true)
    firstLabeledIntegerSelect.querySelector('.integer-select-type').style.fontWeight = 'bold'
  }
}
customElements.define('labeled-integer-select-collection', LabeledIntegerSelectCollection)

class IntegerSelect extends HTMLSelectElement {
  type
  constructor() {
    super()
    this.type = this.getAttribute('type')
  }
  relaySelection() {
    const e = new CustomEvent('labeled-integer-select-event', { 
      detail: {
        type: this.type,
        value: this.options[this.selectedIndex].value
      }
    })
  // if in a collection, tell the collection so it can update its display
  const closestCollection = this.closest('labeled-integer-select-collection')
  if (closestCollection) {
    closestCollection.dispatchEvent(e)
  }
  // tell the app so it can save/restore the collection's choice
  dispatchEvent(e)
}
  connectedCallback() {
    const count = parseInt(this.getAttribute('count'))
    let options = ''
    const lookupInstance = parseInt(getLookupInstance(this.type))
    for (let i = 1; i < count; i++) {
      let selected = ( i == lookupInstance ) ? 'selected' : ''
      options += `<option ${selected}>${i}</option>`
    }
    this.innerHTML = options
    this.onclick = this.relaySelection
  }
}
customElements.define('integer-select', IntegerSelect, { extends: "select" })


// main

hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))
const userContainer = hlib.getById('userContainer')
hlib.createFacetInputForm(userContainer, 'Hypothesis username matching API token')
userInput = userContainer.querySelector('input')
userInput.value = localStorage.getItem('h_user')
userInput.onchange = setUser

window.onload = app({advanceToSavedState: true})


