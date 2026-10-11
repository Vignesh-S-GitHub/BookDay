from workers import asgi

from bookday.app import app

Default = asgi.entrypoint(app)
