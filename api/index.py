# fastapi entrypoint, deployed as a vercel serverless function
# all backend logic lives in api/_lib, this file only wires it together

from fastapi import FastAPI

app = FastAPI(title="web-url-shortener api", docs_url=None, redoc_url=None)


@app.get("/api/py/health")
def health():
    return {"status": "ok"}
