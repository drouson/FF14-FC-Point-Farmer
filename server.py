import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import sys

PORT = 8000
XIVAPI_BASE = "https://v2.xivapi.com/api"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Check if the request is for the API proxy
        if self.path.startswith("/api_proxy"):
            self.handle_proxy_request()
        else:
            # Serve static files as usual
            super().do_GET()

    def handle_proxy_request(self):
        try:
            # Extract the actual API path/query
            # Example: /api_proxy/search?query=... -> /search?query=...
            path_suffix = self.path.replace("/api_proxy", "", 1)
            
            target_url = XIVAPI_BASE + path_suffix
            print(f"Proxying request to: {target_url}")

            # Create the request to XIVAPI
            req = urllib.request.Request(target_url)
            req.add_header("User-Agent", "FF14-Point-Farmer-Proxy/1.0")

            # Execute request
            with urllib.request.urlopen(req) as response:
                content_type = response.getheader('Content-Type')
                data = response.read()

                # Send response back to browser
                self.send_response(response.status)
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*') # Allow CORS
                self.end_headers()
                self.wfile.write(data)

        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            print(f"Proxy Error: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

if __name__ == "__main__":
    Handler = ProxyHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print(f"API Proxy active at http://localhost:{PORT}/api_proxy")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
