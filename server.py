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
import os

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default logging noise; uncomment next line to re-enable:
        # print(f"  {args[0]} {args[1]}")
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print(f"\n  ♪ TuneGuess server running at http://localhost:{PORT}")
print(f"  Press Ctrl+C to stop.\n")

webbrowser.open(f"http://localhost:{PORT}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
