"""
reader.py — Camada 1: leitura.
Responsável APENAS por buscar e normalizar dados da API. Sem lógica de decisão.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Any

from api_client import paginate

logger = logging.getLogger(__name__)


def _ensure_account_id(account_id: str) -> str:
    """A Graph API exige o prefixo act_ no account_id."""
    return account_id if account_id.startswith("act_") else f"act_{account_id}"


def _parse_roas(roas_field: Any) -> float:
    """
    purchase_roas vem da API como lista de objetos [{action_type, value}].
    Extrai o valor do tipo de conversão mais relevante.
    """
    if not roas_field:
        return 0.0
    if isinstance(roas_field, (int, float)):
        return float(roas_field)

    # Prioridade: omni_purchase (todos os canais) > pixel purchase
    priority = ("omni_purchase", "offsite_conversion.fb_pixel_purchase")
    index = {entry.get("action_type"): entry for entry in roas_field}

    for action_type in priority:
        if action_type in index:
            return float(index[action_type].get("value", 0))

    # fallback: primeiro entry disponível
    return float(roas_field[0].get("value", 0))


def get_campaign_insights(date_window_days: int = 7) -> list[dict]:
    """
    Busca insights e atributos de todas as campanhas ATIVAS do ad account.

    Faz duas chamadas à API e as mescla:
      1. /campaigns — atributos estáticos (daily_budget, effective_status)
      2. /insights  — métricas de performance no período (spend, roas)

    Retorna lista de dicts normalizados:
      campaign_id, campaign_name, spend (R$), purchase_roas,
      daily_budget (centavos), effective_status
    """
    account_id = _ensure_account_id(os.environ["META_AD_ACCOUNT_ID"])

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=date_window_days - 1)
    time_range = f'{{"since":"{start_date}","until":"{end_date}"}}'

    # ── 1. Campanhas ativas com orçamento ────────────────────────────────────
    logger.info("Buscando campanhas ativas em %s...", account_id)
    raw_campaigns = paginate(
        f"{account_id}/campaigns",
        params={
            "effective_status": '["ACTIVE"]',
            "fields": "id,name,daily_budget,effective_status",
            "limit": 100,
        },
    )

    campaign_attrs: dict[str, dict] = {
        c["id"]: {
            "campaign_name": c.get("name", ""),
            "daily_budget": int(c.get("daily_budget", 0)),
            "effective_status": c.get("effective_status", "ACTIVE"),
        }
        for c in raw_campaigns
    }
    logger.info("%d campanhas ativas encontradas", len(campaign_attrs))

    # ── 2. Insights de performance ───────────────────────────────────────────
    logger.info("Buscando insights de %s a %s...", start_date, end_date)
    raw_insights = paginate(
        f"{account_id}/insights",
        params={
            "level": "campaign",
            "fields": "campaign_id,campaign_name,spend,purchase_roas",
            "time_range": time_range,
            "limit": 100,
        },
    )

    # ── 3. Mescla e normaliza ─────────────────────────────────────────────────
    results: list[dict] = []
    for ins in raw_insights:
        cid = ins.get("campaign_id", "")
        attrs = campaign_attrs.get(cid, {})

        results.append({
            "campaign_id": cid,
            "campaign_name": ins.get("campaign_name") or attrs.get("campaign_name", ""),
            "spend": float(ins.get("spend", 0)),
            "purchase_roas": _parse_roas(ins.get("purchase_roas")),
            "daily_budget": attrs.get("daily_budget", 0),  # centavos
            "effective_status": attrs.get("effective_status", "ACTIVE"),
        })

    logger.info("%d campanhas com dados de insights retornadas", len(results))
    return results
