"""
engine.py — Camada 2: motor de decisão.

TOTALMENTE isolado: não faz chamadas à API nem executa ações.
Recebe dados, avalia regras de config.py, devolve lista de ações.

Para adicionar/mudar regras: edite APENAS config.py.
"""

import logging
import config

logger = logging.getLogger(__name__)

# Hard limit de segurança — protege a fase de aprendizado do algoritmo da Meta.
# NÃO altere este valor aqui; está fora do config intencionalmente.
MAX_BUDGET_INCREASE_PCT = 20


def _conditions_met(campaign: dict, conditions: dict) -> bool:
    """Retorna True se a campanha satisfaz TODAS as condições da regra."""
    roas = campaign["purchase_roas"]
    spend = campaign["spend"]
    budget = campaign["daily_budget"]

    checks = {
        "min_roas": lambda: roas >= conditions["min_roas"],
        "max_roas": lambda: roas <= conditions["max_roas"],
        "min_spend": lambda: spend >= conditions["min_spend"],
        "max_spend": lambda: spend <= conditions["max_spend"],
        # at_budget_cap: True → campanha precisa ter atingido o teto configurado
        "at_budget_cap": lambda: budget >= config.BUDGET_CAP_CENTS,
    }

    for key, check in checks.items():
        if key in conditions and not check():
            return False

    return True


def _safe_new_budget(current_cents: int, requested_pct: float) -> tuple[int, float]:
    """
    Calcula o novo orçamento aplicando o teto de 20%.
    Retorna (novo_valor_centavos, percentual_real_aplicado).
    """
    applied_pct = min(requested_pct, MAX_BUDGET_INCREASE_PCT)
    new_budget = int(current_cents * (1 + applied_pct / 100))
    return new_budget, applied_pct


def evaluate(campaigns: list[dict]) -> list[dict]:
    """
    Avalia cada campanha contra as regras em config.RULES.
    Retorna lista de ações prontas para o actor executar.

    Comportamento:
      - Regras avaliadas em ordem (stop-first: primeira que bater é aplicada).
      - Aumento de budget sempre limitado a MAX_BUDGET_INCREASE_PCT.
      - "duplicate" só é gerada se daily_budget >= config.BUDGET_CAP_CENTS
        (camada de segurança extra além da condição at_budget_cap na regra).
    """
    actions: list[dict] = []

    for campaign in campaigns:
        cid = campaign["campaign_id"]
        cname = campaign["campaign_name"]

        for rule in config.RULES:
            rule_name = rule["name"]
            conditions = rule["conditions"]
            action_cfg = rule["action"]

            if not _conditions_met(campaign, conditions):
                continue

            action_type = action_cfg["type"]

            # ── scale_budget ─────────────────────────────────────────────
            if action_type == "scale_budget":
                requested_pct = action_cfg.get("pct", 10)
                new_budget, applied_pct = _safe_new_budget(
                    campaign["daily_budget"], requested_pct
                )

                if applied_pct < requested_pct:
                    logger.warning(
                        "[SEGURANÇA] '%s' (%s) — aumento reduzido de %.0f%% → %.0f%% "
                        "(teto anti-reset de aprendizado)",
                        cname, cid, requested_pct, applied_pct,
                    )

                logger.info(
                    "[DECISÃO] '%s' | regra='%s' | budget %d → %d centavos (+%.0f%%) "
                    "| roas=%.2f spend=R$%.2f",
                    cname, rule_name,
                    campaign["daily_budget"], new_budget, applied_pct,
                    campaign["purchase_roas"], campaign["spend"],
                )

                actions.append({
                    "campaign_id": cid,
                    "campaign_name": cname,
                    "rule_name": rule_name,
                    "action_type": "scale_budget",
                    "current_budget_cents": campaign["daily_budget"],
                    "new_budget_cents": new_budget,
                    "applied_pct": applied_pct,
                    "meta": {
                        "roas": campaign["purchase_roas"],
                        "spend": campaign["spend"],
                    },
                })
                break  # stop-first

            # ── duplicate ────────────────────────────────────────────────
            elif action_type == "duplicate":
                # Guarda extra: nunca duplicar se não atingiu o teto
                if campaign["daily_budget"] < config.BUDGET_CAP_CENTS:
                    logger.debug(
                        "[BLOQUEADO] '%s' — 'duplicate' ignorado: budget %d < teto %d",
                        cname, campaign["daily_budget"], config.BUDGET_CAP_CENTS,
                    )
                    continue

                logger.info(
                    "[DECISÃO] '%s' | regra='%s' | DUPLICAR campanha "
                    "| budget=%d roas=%.2f spend=R$%.2f",
                    cname, rule_name,
                    campaign["daily_budget"], campaign["purchase_roas"], campaign["spend"],
                )

                actions.append({
                    "campaign_id": cid,
                    "campaign_name": cname,
                    "rule_name": rule_name,
                    "action_type": "duplicate",
                    "meta": {
                        "roas": campaign["purchase_roas"],
                        "spend": campaign["spend"],
                        "daily_budget": campaign["daily_budget"],
                    },
                })
                break  # stop-first

            else:
                logger.warning("Tipo de ação desconhecido na regra '%s': %s", rule_name, action_type)

        else:
            logger.debug("[SEM AÇÃO] '%s' (%s) — nenhuma regra disparada", cname, cid)

    return actions
