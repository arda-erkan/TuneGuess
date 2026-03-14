#!/usr/bin/env python3
"""
Simple local HTTP server for TuneGuess.
Run this file, then open http://localhost:8080 in your browser.

Usage:
  python server.py
  python3 server.py          (on some systems)
"""

import http.server
import socketserver
import webbrowser
import threading
import os
import mimetypes

PORT = 8080

# ── Ensure .js and .css are served with the correct MIME types ────────────────
# On Windows the registry may be missing these, causing browsers to refuse
# to execute scripts served as text/plain.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css",               ".css")
mimetypes.add_type("text/html",              ".html")

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Uncomment the line below to see request logs:
        # print(f"  [{args[1]}] {args[0]}")
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# ── Create and bind the server FIRST, then open the browser ──────────────────
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"\n  ♪ TuneGuess is running at http://localhost:{PORT}")
    print(f"  Press Ctrl+C to stop.\n")

    # Open browser after server is bound and listening
    threading.Timer(0.3, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
