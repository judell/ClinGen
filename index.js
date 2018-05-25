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

const appVars = {
  GENE: undefined,
  ARTICLE: undefined,
  URL: undefined,
  SELECTION: undefined,
  PREFIX: undefined,
  START: undefined,
  END: undefined
}

var eventData = {};

const appWindowName = 'ClinGen';

const clingenGroup = '__world__';

// interactive params
var tokenContainer;
var userContainer;

window.addEventListener('message', function(event) {
  if ( event.data === 'CloseClinGen' ) {
    window.close()
  } else if (event.data.tags && event.data.tags.indexOf('ClinGen') != -1) {
    console.log('index2', event.data);
    eventData = event.data;
    app(event);
  }
});

// called with a load event initially, then with message events
function app(event) {

  debugger;

  if (event.type==='load') {   // advance state machine to cached FSM state
    var savedState = localStorage.getItem(storageKeys.STATE);
    console.log(`load before init, savedState ${savedState}, FSM.state ${FSM.state}`);
    FSM.init(); 
    console.log(`load after init, savedState ${savedState}, FSM.state ${FSM.state}`);
    if (savedState === 'haveGene') {
      console.log(`load before getGene, savedState ${savedState}, FSM.state ${FSM.state}`);
      FSM.getGene();
      console.log(`load after getGene, savedState ${savedState}, FSM.state ${FSM.state}`);
    } else  if (savedState === 'inMonarchLookup') {
      console.log(`load before inMonarchLookup, savedState ${savedState}, FSM.state ${FSM.state}`);
      FSM.getGene(); FSM.beginMonarchLookup();
      console.log(`load after inMonarchLookup, savedState ${savedState}, FSM.state ${FSM.state}`);
    }
  } else {                     
    saveApiParams(event.data);  // save params for H api call
  }

  loadAppVars();                

  refreshUiAppVars();

  if ( ! event || event.type==='load') {
    appendViewer( 
      `<p>You've added the ClinGen button in another tab. To proceed with curation, 
      go there and click the button.`
    );
    return;
  }

  // window is open, handle messages

  refreshUiAppVars();
  
  clearUI();
  
    // initialize  interactive params
  tokenContainer = getById('tokenContainer');
  userContainer = getById('userContainer');

  appendViewer(`
  <p>Current article: ${appVars.ARTICLE}
  <p>Current gene: ${appVars.GENE}
  `);

  if ( FSM.state === 'needGene' && ! appVars.SELECTION ) {
    appendViewer(`
      <p>To begin a gene curation:
      <ul>
      <li>Go to an article to which you've added the ClinGen button.
      <li>Select the name of a gene.
      <li>Click the ClinGen button.
      </ul>`
    );
  } else if ( FSM.state === 'needGene' && appVars.SELECTION) {
    appendViewer(`
      <p>Begin a gene curation for <b>${appVars.SELECTION} in ${appVars.URL}</b>
      <p><button onclick="getGene()"> begin </button>`
    );
  } else if ( FSM.state === 'haveGene' && ! appVars.SELECTION) {
    appendViewer(`
      <p>You're ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:hpoLookup">HPO lookups</a>.
      <p>Nothing is selected in the current article, however. 
      <p>To proceed with HPO lookups, select a term in the article, then click the ClinGen button to continue.`
    );
  } else if (FSM.state === 'haveGene' && appVars.SELECTION) {
    appendViewer(`
      <p>You're ready for <a target="_lookup" href="https://hypothes.is/search?q=tag:gene:${appVars.GENE}+tag:hpoLookup">HPO lookups</a>.
      <p>Your selection in the current article is <i>${appVars.SELECTION}</i>.  You can:
      <ul>
      <li>Find it <a href="javascript:monarchLookup()">monarch</a>
      <li>Find it <a href="javascript:mseqdrLookup()">mseqdr</a>
      <li>Go back to the current article, select a term for HPO lookup, and click the ClinGen button.
      </ul>`
    );
  } else if ( FSM.state === 'inMonarchLookup') {
    appendViewer(`
      <p>Annotate the current article with a reference to  
      <a href="${appVars.URL}">${appVars.URL}</a> as the Monarch lookup result for <i>"${appVars.SELECTION}"</i>?
      <p><button onclick="saveMonarchLookup()">post</button>`
    );
  } else {
    console.log('unexpected state', FSM.state);
  }
}

// workflow functions

function _getGene() {
  var params = getApiBaseParams();
  params.tags.push('gene:' + appVars.SELECTION);
  params.tags = params.tags.concat(getPmidAndDoi());
  const payload = createAnnotationPayload(params);
  const token = getToken();
  postAnnotationUpdateStateAndRedirect(payload, token, 'annotations:query:', 'getGene');
}

function getGene() {
  createApiTokenInputForm(tokenContainer);
  createUserInputForm(userContainer);
  var params = getApiBaseParams();
  params.tags = params.tags.concat(getPmidAndDoi());
  writeViewer(`
    <div>  
      <p>Post this annotation to begin curation of <b>${appVars.SELECTION}</b>?</p>
      <pre>  ${JSON.stringify(params, null, 2)}  </pre>
    </div>`
  );
  getById('actionButton').innerHTML = `<button onclick="_getGene()">post</button>`;
}

function mseqdrLookup() {
  //var url = `https://mseqdr.org/search_phenotype.php?hponame=${appVars.SELECTION}&dbsource=HPO`;
  //location.href = url;
}

function monarchLookup() {
  FSM.beginMonarchLookup();
  var url = `https://monarchinitiative.org/search/${appVars.SELECTION}`;
  window.open(url, appWindowName);
  window.close();
}

function saveMonarchLookup() {
  let params = getApiBaseParams();
  params.text = `Monarch lookup result: <a href="${appVars.URL}">${appVars.URL}</a>`;
  params.uri = appVars.ARTICLE; // target is the article, /not/ the lookup result page
  params.tags = params.tags.concat(['hpoLookup', 'monarchLookup', `gene:${appVars.GENE}`]);
  console.log('params for monarch', params);
  const payload = createAnnotationPayload(params);
  const token = getToken();
  postAnnotationUpdateStateAndRedirect(payload, token, 'annotations:query:', 'saveMonarchLookup');
}

// utility functions

function getPmidAndDoi() {
  var tags = [];
  if (eventData.pmid) {
    tags.push('pmid:'+eventData.pmid);
  }
  if (eventData.doi) {
    tags.push('doi:'+eventData.doi);
  }
  return tags;
}


function saveApiParams(params) {
  appVars.URL = params.uri;
  if (appVars.URL) {
    saveUrl(appVars.URL);
  }
  appVars.SELECTION = params.exact;
  if (appVars.SELECTION) {
    saveSelection(appVars.SELECTION.trim());
  }
  appVars.PREFIX = params.prefix;
  if (appVars.PREFIX) {
    savePrefix(appVars.PREFIX);
  }
  appVars.START = params.start;
  if (appVars.START) {
    saveStart(appVars.START);
  }
  appVars.END = params.end;
  if (appVars.END) {
    saveEnd(appVars.END);
  }
}

function getApiBaseParams() {
  return {
    group: clingenGroup,
    username: getUser(),
    uri: appVars.URL,
    exact: appVars.SELECTION,
    prefix: appVars.PREFIX,
    start: appVars.START,
    end: appVars.END,
    tags: ['ClinGen'],
  }
}

function loadAppVars() {
  appVars.GENE = localStorage.getItem(storageKeys.GENE);
  appVars.ARTICLE = localStorage.getItem(storageKeys.ARTICLE);
  appVars.URL = localStorage.getItem(storageKeys.URL);
  appVars.SELECTION = localStorage.getItem(storageKeys.SELECTION);
  appVars.PREFIX = localStorage.getItem(storageKeys.PREFIX);
  appVars.START = localStorage.getItem(storageKeys.START);
  appVars.END = localStorage.getItem(storageKeys.END);
}

function refreshUiAppVars() {
  setTimeout(function() {
    getById('STATE').innerHTML = FSM.state;
    getById('ARTICLE').innerHTML = appVars.ARTICLE;
    getById('GENE').innerHTML = appVars.GENE;
    getById('URL').innerHTML = appVars.URL;
    getById('SELECTION').innerHTML = appVars.SELECTION;
    getById('PREFIX').innerHTML = appVars.PREFIX;
    getById('START').innerHTML = appVars.START;
    getById('END').innerHTML = appVars.END;

  }, 0); // defer until end of current tick to allow fsm to complete transaction
}

function resetWorkflow() {
  Object.values(storageKeys).forEach(storageKey => {
    delete localStorage[storageKey];
  });
  Object.values(appVars).forEach(appVar => {
    delete appVars[appVar];
  });
  window.close()
}

function appendViewer(str) {
  getById('viewer').innerHTML += str;
}

function writeViewer(str) {
  getById('viewer').innerHTML = str;
}

function  clearUI() {
  getById('viewer').innerHTML = '';
  getById('userContainer').innerHTML = '';
  getById('tokenContainer').innerHTML = '';
  getById('actionButton').innerHTML = '';
}

function saveArticle(article) {
  localStorage.setItem(storageKeys.ARTICLE, article);
}

function saveGene(gene) {
  localStorage.setItem(storageKeys.GENE, gene);
}

function saveUrl(url) {
  localStorage.setItem(storageKeys.URL, url);
}

function saveSelection(selection) {
  localStorage.setItem(storageKeys.SELECTION, selection);
}

function clearSelection() {
  delete localStorage[storageKeys.SELECTION];
  delete appVars.SELECTION;
}

function savePrefix(prefix) {
  localStorage.setItem(storageKeys.PREFIX, prefix);
}

function saveStart(start) {
  localStorage.setItem(storageKeys.START, start);
}

function saveEnd(end) {
  localStorage.setItem(storageKeys.END, end);
}

function postAnnotationUpdateStateAndRedirect(payload, token, queryFragment, transition) {
  
  function transit(transition) {
    if (transition==='getGene') {
      saveArticle(appVars.URL);
      saveGene(appVars.SELECTION);
      loadAppVars();
      FSM.getGene();
    } else if (transition==='saveMonarchLookup') {
      FSM.saveMonarchLookup();
    }
    refreshUiAppVars();
  }

  return postAnnotation(payload, token)
    .then(data => {

      var response = JSON.parse(data.response);
      if (data.status != 200) {
        alert(`hlib status ${data.status}`);
        return;
      }

      debugger;

      clearUI();

      transit(transition);

      refreshUiAppVars();

      writeViewer(`<p>Annotation posted.
       <div><iframe src="https://hypothes.is/a/${response.id}" width="350" height="400"></iframe></div>
       <p>Click the ClinGen button to proceed.`
      );
    })
    .catch(e => {
      console.log(e);
    });
}

var FSM = function() {
  debugger
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
        localStorage.setItem(storageKeys.STATE, lifecycle.to);
      },

    }
  });

  return fsm;

}();

window.onload = app;

