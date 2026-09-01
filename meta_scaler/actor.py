"""
actor.py — Camada 3: execução de ações.

Única camada que modifica dados na API.
Com DRY_RUN=True (default), apenas loga o que FARIA — sem nenhuma chamada real.
"""

import logging
from api_client import graph_post

logger = logging.getLogger(__name__)


def _scale_budget(campaign_id: str, new_budget_cents: int, dry_run: bool) -> None:
    if dry_run:
        logger.info(
            "[DRY-RUN] ATUALIZARIA budget da campanha %s → %d centavos (R$ %.2f)",
            campaign_id, new_budget_cents, new_budget_cents / 100,
        )
        return

    result = graph_post(campaign_id, data={"daily_budget": new_budget_cents})
    logger.info(
        "[EXECUTADO] Budget da campanha %s atualizado → %d centavos | resposta: %s",
        campaign_id, new_budget_cents, result,
    )


def _duplicate_campaign(campaign_id: str, dry_run: bool) -> None:
    if dry_run:
        logger.info("[DRY-RUN] DUPLICARIA campanha %s (chegaria pausada)", campaign_id)
        return

    # deep_copy=True copia adsets e anúncios junto.
    # status_option=PAUSED: a cópia chega pausada — operador ativa manualmente.
    result = graph_post(
        f"{campaign_id}/copies",
        data={"deep_copy": True, "status_option": "PAUSED"},
    )
    logger.info("[EXECUTADO] Campanha %s duplicada | resposta: %s", campaign_id, result)


def execute(actions: list[dict], dry_run: bool = True) -> None:
    """
    Executa (ou simula) a lista de ações produzida pelo engine.

    dry_run=True  → loga o que faria, zero chamadas à API.
    dry_run=False → chama a Graph API de verdade.
    """
    mode = "DRY-RUN" if dry_run else "PRODUÇÃO"
    logger.info("=== Executando %d ação(ões) no modo %s ===", len(actions), mode)

    if not actions:
        logger.info("Nenhuma ação planejada. Encerrando.")
        return

    for action in actions:
        cid = action["campaign_id"]
        cname = action["campaign_name"]
        rule = action["rule_name"]
        atype = action["action_type"]

        logger.info(
            "→ campanha='%s' | regra='%s' | ação='%s'", cname, rule, atype
        )

        try:
            if atype == "scale_budget":
                _scale_budget(cid, action["new_budget_cents"], dry_run)

            elif atype == "duplicate":
                _duplicate_campaign(cid, dry_run)

            else:
                logger.warning("Tipo de ação não implementado: '%s' (campanha %s)", atype, cid)

        except Exception:
            # Loga o erro mas continua processando as demais campanhas
            logger.exception(
                "Erro ao executar ação '%s' para '%s' (%s)", atype, cname, cid
            )
