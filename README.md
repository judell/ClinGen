# ClinGen
An approach to annotation-powered biocuration

Runs from a bookmarklet, e.g.:

javascript:(function(){var d=document; var s=d.createElement('script');s.setAttribute('src','https://jonudell.info/hlib/StandaloneAnchoring.js');d.head.appendChild(s); s=d.createElement('script');s.setAttribute('src','https://jonudell.info/hlib/hlib.bundle.js');d.head.appendChild(s); s=d.createElement('script');s.setAttribute('src','https://jonudell.info/h/ClinGen/gather.js');d.head.appendChild(s);})();

Uses https://github.com/jakesgordon/javascript-state-machine and https://github.com/judell/hlib

Demos: http://jonudell.info/h/workflow_02.mp4, http://jonudell.info/h/workflow_03.mp4
