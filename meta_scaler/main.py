"""
main.py — Entry point. Orquestra as 3 camadas.
Projetado para rodar 1x/dia via cron. Não faz loop.

Variáveis de ambiente necessárias (defina no .env):
  META_ACCESS_TOKEN  — token com permissão ads_management
  META_AD_ACCOUNT_ID — ID da conta de anúncios (com ou sem prefixo act_)
  DRY_RUN            — "true" (default) ou "false"
"""

import logging
import os
import sys

from dotenv import load_dotenv

import actor
import config
import engine
import reader


def _setup_logging() -> None:
    fmt = "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        datefmt="%Y-%m-%dT%H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("scaler.log", encoding="utf-8"),
        ],
    )


def main() -> None:
    load_dotenv()
    _setup_logging()

    log = logging.getLogger(__name__)

    # Valida credenciais obrigatórias antes de qualquer chamada
    for var in ("META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"):
        if not os.environ.get(var):
            log.error("Variável de ambiente obrigatória não definida: %s", var)
            sys.exit(1)

    dry_run = os.environ.get("DRY_RUN", "true").strip().lower() != "false"

    log.info("=" * 60)
    log.info("Meta Campaign Scaler iniciado")
    log.info("Modo    : %s", "DRY-RUN (simulação)" if dry_run else "PRODUÇÃO — alterações reais")
    log.info("Janela  : últimos %d dias", config.DATE_WINDOW_DAYS)
    log.info("Teto    : R$ %.2f / dia", config.BUDGET_CAP_CENTS / 100)
    log.info("Regras  : %d configuradas", len(config.RULES))
    log.info("=" * 60)

    # ── Camada 1: leitura ────────────────────────────────────────────────────
    campaigns = reader.get_campaign_insights(date_window_days=config.DATE_WINDOW_DAYS)

    if not campaigns:
        log.info("Nenhuma campanha ativa com dados de insight. Encerrando.")
        return

    # ── Camada 2: decisão ────────────────────────────────────────────────────
    actions = engine.evaluate(campaigns)
    log.info("%d ação(ões) planejada(s) para %d campanha(s)", len(actions), len(campaigns))

    # ── Camada 3: execução ───────────────────────────────────────────────────
    actor.execute(actions, dry_run=dry_run)

    log.info("=" * 60)
    log.info("Execução finalizada")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
