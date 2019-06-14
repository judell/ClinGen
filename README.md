# ClinGen
An approach to annotation-powered biocuration

Runs from a bookmarklet, e.g.:

```javascript:(function(){var d=document; var s=d.createElement('script');s.setAttribute('src','https://jonudell.info/hlib/StandaloneAnchoring.js');d.head.appendChild(s); s=d.createElement('script');s.setAttribute('src','https://jonudell.info/hlib/hlib.bundle.js');d.head.appendChild(s); s=d.createElement('script');s.setAttribute('src','https://jonudell.info/h/ClinGen/gather.js');d.head.appendChild(s);})();```

Uses https://github.com/jakesgordon/javascript-state-machine and https://github.com/judell/hlib

## Tests

To run the tests:

1. python server.py

2. visit http://localhost:8001/

3. Enter your Hypothesis username and token

4. In gather.js, use the alternate opener `window.open( `http://localhost:8001/index.html ...`

5. visit http://localhost.8001/test.html

## Demos

Interactive 

- http://jonudell.info/h/workflow_05.mp4
- http://jonudell.info/h/workflow_04.mp4
- http://jonudell.info/h/workflow_03.mp4
- http://jonudell.info/h/workflow_02.mp4

Test harness

- http://jonudell.info/h/clingen-test-harness-01.mp4
