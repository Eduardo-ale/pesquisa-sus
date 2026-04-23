"""
Servidor local: consulta a API Datasus (MS) e serve a interface em /.
Execute: uvicorn app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

BASE_URL = "https://core.saude.ms.gov.br/r2/web/datasus/index.php"
STATIC_DIR = Path(__file__).parent / "static"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
# Cabeçalhos próximos de um navegador real — alguns WAFs bloqueiam clientes “minimalistas”.
HEADERS_DATASUS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json, text/javascript, */*;q=0.01",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://core.saude.ms.gov.br/",
    "Origin": "https://core.saude.ms.gov.br",
}

app = FastAPI(title="Consulta Datasus (MS)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _apenas_digitos(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _json_from_response(r: httpx.Response):
    """
    A API do MS costuma retornar JSON com acentos em bytes Latin-1 / CP1252;
    o httpx assíncrono por vezes interpreta o corpo de forma incompatível com json().
    """
    for enc in ("utf-8-sig", "utf-8", "iso-8859-1", "cp1252", "latin-1"):
        try:
            t = r.content.decode(enc)
        except UnicodeDecodeError:
            continue
        t = t.lstrip("\ufeff")
        try:
            return json.loads(t)
        except json.JSONDecodeError:
            continue
    return None


@app.get("/api/paciente")
async def get_paciente(
    cns: str | None = Query(default=None, description="Cartão Nacional de Saúde (apenas números)"),
    cpf: str | None = Query(default=None, description="CPF (apenas números, 11 dígitos)"),
):
    cns_tem = cns and _apenas_digitos(cns)
    cpf_tem = cpf and _apenas_digitos(cpf)
    if bool(cns_tem) == bool(cpf_tem):
        raise HTTPException(
            status_code=400,
            detail="Informe exatamente um dos parâmetros: cns ou cpf.",
        )
    if cns_tem:
        c = _apenas_digitos(cns)
        if len(c) < 15:
            raise HTTPException(status_code=400, detail="CNS deve ter 15 dígitos.")
        url = f"{BASE_URL}?cns={c}"
    else:
        c = _apenas_digitos(cpf)
        if len(c) != 11:
            raise HTTPException(status_code=400, detail="CPF deve ter 11 dígitos.")
        url = f"{BASE_URL}?cpf={c}"

    try:
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            r = await client.get(url, headers=HEADERS_DATASUS)
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Falha ao contatar a API: {e!s}") from e

    if r.status_code == 403:
        raise HTTPException(
            status_code=502,
            detail=(
                "API do MS retornou 403 (acesso negado). "
                "Muitas vezes isso ocorre quando o servidor roda fora do Brasil (ex.: nuvem EUA). "
                "Teste rodando o app no seu PC ou em um VPS no Brasil; se local funcionar e na nuvem não, "
                "o bloqueio é pelo destino da API, não pelo código da aplicação."
            ),
        )
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"API retornou status {r.status_code}.",
        )

    data = _json_from_response(r)
    if data is None:
        raise HTTPException(status_code=502, detail="Resposta inválida (não é JSON).")

    if not data:
        raise HTTPException(status_code=404, detail="Nenhum registro encontrado para os dados informados.")
    if not isinstance(data, list):
        raise HTTPException(status_code=502, detail="Formato de resposta inesperado.")
    return data[0]


# Interface: não use StaticFiles em "/" (conflita com a API em muitos ambientes). Servimos
# a página expliciamente e os recursos em /static/ (CSS/JS).
if not STATIC_DIR.is_dir():
    raise RuntimeError("Pasta static/ é obrigatória ao lado de app.py.")


@app.get("/")
def pagina_inicial():
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=500, detail="index.html não encontrada em static/.")
    return FileResponse(index, media_type="text/html; charset=utf-8")


@app.head("/")
def pagina_inicial_head():
    """Evita 405 em HEAD / (alguns proxies e verificações de URL usam só HEAD)."""
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=500, detail="index.html não encontrada em static/.")
    return Response(status_code=200, media_type="text/html; charset=utf-8")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    """Evita 404 no console do navegador (o Chrome pede /favicon.ico por padrão)."""
    return Response(status_code=204)


app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="arquivos_estaticos",
)
