var params;

function app() {

  debugger;

  params = JSON.parse(decodeURIComponent(gup('data')));
  params.username = getUser();
  params.group = getGroup();

  const tokenContainer = getById('tokenContainer');
  createApiTokenInputForm(tokenContainer);

  const userContainer = getById('userContainer');
  createUserInputForm(userContainer);

  const groupContainer = getById('groupContainer');
  createGroupInputForm(groupContainer);

  getById('viewer').innerHTML = `
<div>  
<p>You selected "${params.exact}". Use it to:</p>

<div class="formField">
    <input name="menu" type="radio" onchange="postAnnoForGene()">
      post a root annotation with gene name, pmid, and doi
    <input name="menu" type="radio" value="hpo" onchange="hpoLookup()">
      look up an hpo term
</div>`;

  function postRootAnnoForGene() {
    const viewableParams = Object.assign({}, params);
    delete viewableParams.username;
    delete viewableParams.group;
    getById('viewer').innerHTML = `
<div>  
<p>Post this data as an annotation?</p>
<pre>
${JSON.stringify(viewableParams, null, 2)}  
</pre>
</div>`;
    getById('postButton').innerHTML = `
<div id="postButton"><button onclick="postAnno()">continue</button></div>`;
  }

  function hpoLookup() {
    getById('viewer').innerHTML = 'Coming soon.'
  }
}


function postAnno() {
  const payload = createAnnotationPayload(params);
  const token = getToken();
  postAnnotationAndRedirect(payload, token, 'annotations:query:');
}

window.onload = app;
