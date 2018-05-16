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

function postAnno() {
  const payload = createAnnotationPayload(params);
  const token = getToken();
  postAnnotationAndRedirect(payload, token, 'annotations:query:');
}

window.onload = app;
