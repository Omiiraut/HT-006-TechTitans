from vercel_wsgi import make_wsgi_app
from backend.app import app as flask_app

# Vercel expects a callable named `app` at the top level.
app = make_wsgi_app(flask_app)
