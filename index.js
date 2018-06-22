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

// for message-delivered data other than appVars (e.g. pmid, doi)
var eventData = {}

const appWindowName = 'ClinGen'

// just public for now, can swap in the group picker as/when needed
const clingenGroup = '__world__'

// listen for messages from the host
window.addEventListener('message', function(event) {
  if ( event.data === 'CloseClinGen' ) {
    window.close()
  } else if (event.data.tags && event.data.tags.indexOf('ClinGen') != -1) {
    eventData = event.data
    app(event)
  }
});

// called with a load event initially, then with message events
function app(event) {

  if (event.type==='load') {   // advance state machine to cached FSM state
    var savedState = localStorage.getItem(storageKeys.STATE)
    FSM.init()
    if (savedState === 'haveGene') {
      FSM.getGene()
    } else  if (savedState === 'inMonarchLookup') {
      FSM.getGene(); FSM.beginMonarchLookup()
    }
  } else {                     
    saveApiParams(event.data)  // save params for H api call
  }

  loadAppVars()   

  refreshUiAppVars()

  /*
  if ( ! event || event.type==='load') {
    appendViewer( 
      `<p>You've added the ClinGen button in another tab. To proceed with curation, 
      go there and click the button.`
    )
    return
  }*/

  // app window is open, handle messages
    
  clearUI()
    
  appendViewer(`
  <p>Current article: ${appVars.ARTICLE}
  <p>Current gene: ${appVars.GENE}
  `)

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
      <p>Begin a gene curation for <b>${appVars.SELECTION} in ${appVars.URL}</b>
      <p><button onclick="getGene()"> begin </button>`
    )
  } else if ( FSM.state === 'haveGene' && ! appVars.SELECTION) {
    appendViewer(`
      <p>You're ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:hpoLookup">HPO lookups</a>.
      <p>Nothing is selected in the current article, however. 
      <p>To proceed with HPO lookups, select a term in the article, then click the ClinGen button to continue.`
    )
  } else if (FSM.state === 'haveGene' && appVars.SELECTION) {
    appendViewer(`
      <p>You're ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:hpoLookup">HPO lookups</a>.
      <p>Your selection in the current article is <i>${appVars.SELECTION}</i>.  You can:
      <ul>
      <li>Find it <a href="javascript:monarchLookup()">monarch</a>
      <li>Find it <a href="javascript:mseqdrLookup()">mseqdr</a>
      <li>Go back to the current article, select a term for HPO lookup, and click the ClinGen button.
      </ul>`
    )
  } else if ( FSM.state === 'inMonarchLookup') {
    appendViewer(`
      <p>Annotate the current article with a reference to  
      <a href="${appVars.URL}">${appVars.URL}</a> as the Monarch lookup result for <i>"${appVars.SELECTION}"</i>?
      <p><button onclick="saveMonarchLookup()">post</button>`
    )
  } else {
    console.log('unexpected state', FSM.state)
  }
}

// workflow functions

// helper for getGene()
function _getGene() {
  var params = getApiBaseParams()
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
  var params = getApiBaseParams()
  params.tags = params.tags.concat(getPmidAndDoi())
  writeViewer(`
    <div>  
      <p>Post this annotation to begin curation of <b>${appVars.SELECTION}</b>?</p>
      <pre>  ${JSON.stringify(params, null, 2)}  </pre>
    </div>`
  )
  hlib.getById('actionButton').innerHTML = `<button onclick="_getGene()">post</button>`
}

function mseqdrLookup() {
}

// runs from a link created in the haveGene state
function monarchLookup() {
  FSM.beginMonarchLookup()
  var url = `https://monarchinitiative.org/search/${appVars.SELECTION}`
  window.open(url, appWindowName)
  window.close()
}


// runs from a link created in the inMonarchLookup state
function saveMonarchLookup() {
  let params = getApiBaseParams()
  params.text = `Monarch lookup result: <a href="${appVars.URL}">${appVars.URL}</a>`
  params.uri = appVars.ARTICLE // because the annotation target is the article, /not/ the lookup result page
  params.tags = params.tags.concat(['hpoLookup', 'monarchLookup', `gene:${appVars.GENE}`])
  console.log('params for monarch', params)
  const payload = hlib.createAnnotationPayload(params)
  const token = hlib.getToken()
  postAnnotationAndUpdateState(payload, token, 'saveMonarchLookup')
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

// get base params for an annotation
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

// update the inspector
function refreshUiAppVars() {
  getSvg()
  setTimeout(function() {
    hlib.getById('STATE').innerHTML = FSM.state
    hlib.getById('ARTICLE').innerHTML = appVars.ARTICLE
    hlib.getById('GENE').innerHTML = appVars.GENE
    hlib.getById('URL').innerHTML = appVars.URL
    hlib.getById('SELECTION').innerHTML = appVars.SELECTION
    hlib.getById('PREFIX').innerHTML = appVars.PREFIX
    hlib.getById('START').innerHTML = appVars.START
    hlib.getById('END').innerHTML = appVars.END

  }, 0)
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
    }
    refreshUiAppVars()
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
       <p>Click the ClinGen button to proceed.`
      )
    })
    .catch(e => {
      console.log(e)
    })
}

function getSvg() {
  let dot = StateMachineVisualize(FSM);
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
        if ( (t.innerHTML==='haveGene') && (FSM.state==='needGene') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.getGene();javascript:refreshUiAppVars()">${t.innerHTML}</a>`
        }
        if ( (t.innerHTML==='haveGene') && (FSM.state==='inMonarchLookup') ) {
          t.innerHTML = `<a xlink:href="javascript:FSM.saveMonarchLookup();javascript:refreshUiAppVars()">${t.innerHTML}</a>`
        }
      })
    })
}

var FSM = function() {
  
  var fsm = new StateMachine({

    transitions: [
      { name: 'init',                   from: 'none',                 to: 'needGene'  },
      { name: 'getGene',                from: 'needGene',             to: 'haveGene'  },
      { name: 'beginMonarchLookup',     from: 'haveGene',             to: 'inMonarchLookup' },
      { name: 'saveMonarchLookup',      from: 'inMonarchLookup',      to: 'haveGene' },
      { name: 'beginMseqdrLookup',      from: 'haveGene',             to: 'inMseqdrLookup' },
      { name: 'saveMseqdrLookup',       from: 'inMseqdrLookup',       to: 'haveGene' },
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

