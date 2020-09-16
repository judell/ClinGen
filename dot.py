# a wrapper for the dot command, part of graphviz (sudo apt install graphviz)

import logging
import os
from pyramid.httpexceptions import HTTPFound
from pyramid.view import view_config
from pyramid.response import FileResponse

logging.basicConfig(format='%(asctime)s %(levelname)-8s %(message)s',
                    datefmt='%m-%d %H:%M',
                    filename='dot.log',level=logging.DEBUG
                    )
logger = logging.getLogger('')
console = logging.StreamHandler()
console.setLevel(logging.DEBUG)
logger.addHandler(console)

server_scheme = 'http'
server_host = 'localhost'
server_port = 8002

def serve_file(path=None, file=None, request=None, content_type=None):
    response = FileResponse('%s/%s' % (path, file),
                            request=request,
                            content_type=content_type)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

@view_config( route_name='dot' )
def dot(request):
    with open('fsm.dot','wb') as fsm:
      fsm.write(request.body)
    os.system('dot -Nfontname="Raleway" -Efontname="Raleway" -Tsvg fsm.dot > fsm.svg')
    return serve_file('.', 'fsm.svg', request, 'image/svg+xml')

from wsgiref.simple_server import make_server
from pyramid.config import Configurator
from pyramid.response import Response
from pyramid.static import static_view

config = Configurator()

config.scan()

config.add_route('dot', '/dot')

app = config.make_wsgi_app()

if __name__ == '__main__': 
    server = make_server( server_host, server_port, app )
    server.serve_forever()
    

