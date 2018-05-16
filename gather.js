function gather() {

  debugger;

  var selection = document.getSelection();
  if (! selection.rangeCount ) {
    pleaseSelect();
    return;
  }

  var range = selection.getRangeAt(0);
  var quoteSelector = anchoring.TextQuoteAnchor.fromRange(document.body, range);
  var exact = quoteSelector.exact;
  var prefix = quoteSelector.prefix;

  if (exact === "") {
    pleaseSelect();
    return;
  }

  var positionSelector = anchoring.TextPositionAnchor.fromRange(document.body, range);
  var start = positionSelector.start;
  var end = positionSelector.end;

  var metaDoi = document.head.querySelector('meta[name="citation_doi"]');
  var doi = metaDoi.content ? metaDoi.content : undefined;
  
  var metaPmid = document.head.querySelector('meta[name="citation_pmid"]');
  var pmid = metaPmid.content ? metaPmid.content : undefined;

  var gene = 'gene:' + exact.trim();

  var tags = [gene];

  if ( doi ) { tags.push('doi:' + doi) }

  if ( pmid ) { tags.push('pmid:' + pmid) }

  var params = {
    uri: location.href,
    exact: exact,
    prefix: prefix,
    start: start,
    end: end,
    tags: tags,
  };

  var encodedParams = encodeURIComponent(JSON.stringify(params));

  location.href = `https://jonudell.info/h/ClinGen?data=${encodedParams}`;

  function pleaseSelect() {
    alert("ClinGen: Please select a gene name (e.g. TMEM260) to begin.");
  }
}

setTimeout(gather, 1000); // wait for anchoring support to load

