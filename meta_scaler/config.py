# ─────────────────────────────────────────────────────────────────────────────
# config.py — EDITE AQUI. Não precisa tocar em nenhum outro arquivo.
# ─────────────────────────────────────────────────────────────────────────────

# Janela de lookback para buscar insights (dias)
DATE_WINDOW_DAYS = 7

# Teto de orçamento diário em CENTAVOS. Campanhas que atingem este valor
# ficam elegíveis à ação "duplicate" (quando a regra exige at_budget_cap=True).
# Exemplo: 10_000 = R$ 100,00
BUDGET_CAP_CENTS = 10_000


# ─────────────────────────────────────────────────────────────────────────────
# REGRAS DE ESCALA
#
# Avaliadas em ORDEM — a PRIMEIRA que bater é aplicada (stop-first).
#
# Condições disponíveis:
#   min_roas      : ROAS mínimo no período (float)
#   max_roas      : ROAS máximo no período (float)
#   min_spend     : gasto mínimo no período em R$ (float)
#   max_spend     : gasto máximo no período em R$ (float)
#   at_budget_cap : True → só aplica se daily_budget >= BUDGET_CAP_CENTS
#
# Ações disponíveis:
#   type "scale_budget" + pct: aumenta daily_budget em X%
#                              (máximo real aplicado = 20% — hard limit do engine)
#   type "duplicate"          : copia a campanha (duplicada chega PAUSADA)
#                              só executa se daily_budget >= BUDGET_CAP_CENTS
# ─────────────────────────────────────────────────────────────────────────────

RULES = [
    # Regra 1 — ROAS excelente E já no teto de orçamento → duplicar
    # (deve vir antes da regra de escala para ter prioridade)
    {
        "name": "roas_excelente_no_teto_duplicar",
        "conditions": {
            "min_roas": 5.0,
            "min_spend": 100.0,
            "at_budget_cap": True,
        },
        "action": {
            "type": "duplicate",
        },
    },

    # Regra 2 — ROAS muito alto → escalar 20% (teto de segurança)
    {
        "name": "roas_muito_alto_escala_maxima",
        "conditions": {
            "min_roas": 5.0,
            "min_spend": 50.0,
        },
        "action": {
            "type": "scale_budget",
            "pct": 20,
        },
    },

    # Regra 3 — ROAS bom → escalar 10%
    {
        "name": "roas_bom_escala_moderada",
        "conditions": {
            "min_roas": 3.0,
            "min_spend": 50.0,
        },
        "action": {
            "type": "scale_budget",
            "pct": 10,
        },
    },
]
