"""
api_client.py — wrapper da Graph API com retry + exponential backoff.
Todos os outros módulos importam daqui. Não tem lógica de negócio.
"""

import os
import time
import logging

import requests

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

MAX_RETRIES = 5
INITIAL_BACKOFF_SECONDS = 2

# Códigos de erro da Meta que indicam rate limit
RATE_LIMIT_CODES = {17, 32, 80000, 80003, 80004}


def _access_token() -> str:
    token = os.environ.get("META_ACCESS_TOKEN")
    if not token:
        raise EnvironmentError("META_ACCESS_TOKEN não definido no ambiente")
    return token


def _call(method: str, url: str, params: dict | None = None, json: dict | None = None) -> dict:
    """
    Faz uma chamada HTTP à Graph API com retry automático em rate limit e erros de rede.
    Raises RuntimeError se a API retornar um erro não-transiente.
    """
    params = {**(params or {}), "access_token": _access_token()}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.request(method, url, params=params, json=json, timeout=30)
            data = resp.json() if resp.content else {}

            # Detecta rate limit via HTTP 429 ou código de erro Meta
            api_error = data.get("error", {}) if isinstance(data, dict) else {}
            is_rate_limit = (
                resp.status_code == 429
                or api_error.get("code") in RATE_LIMIT_CODES
                or api_error.get("error_subcode") in RATE_LIMIT_CODES
            )

            if is_rate_limit:
                wait = INITIAL_BACKOFF_SECONDS ** attempt
                logger.warning(
                    "Rate limit detectado — aguardando %ds (tentativa %d/%d)",
                    wait, attempt, MAX_RETRIES,
                )
                time.sleep(wait)
                continue

            if api_error:
                raise RuntimeError(
                    f"API error {api_error.get('code')}: {api_error.get('message')}"
                )

            resp.raise_for_status()
            return data

        except requests.exceptions.RequestException as exc:
            if attempt == MAX_RETRIES:
                raise
            wait = INITIAL_BACKOFF_SECONDS ** attempt
            logger.warning("Erro de rede: %s — retry em %ds (%d/%d)", exc, wait, attempt, MAX_RETRIES)
            time.sleep(wait)

    raise RuntimeError(f"Falhou após {MAX_RETRIES} tentativas: {method} {url}")


def graph_get(path: str, params: dict | None = None) -> dict:
    return _call("GET", f"{BASE_URL}/{path.lstrip('/')}", params=params)


def graph_post(path: str, data: dict | None = None) -> dict:
    return _call("POST", f"{BASE_URL}/{path.lstrip('/')}", json=data)


def paginate(path: str, params: dict | None = None) -> list[dict]:
    """
    Coleta TODOS os resultados de um endpoint paginado (cursor-based).
    Retorna lista plana de objetos.
    """
    results: list[dict] = []
    current_params = dict(params or {})

    while True:
        data = graph_get(path, current_params)
        results.extend(data.get("data", []))

        after = data.get("paging", {}).get("cursors", {}).get("after")
        if not after:
            break

        current_params = {**current_params, "after": after}

    return results
