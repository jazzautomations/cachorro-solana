# cachorro-solana — run: Veilo privacy_pool (validation/dogfood)
Target: GYy4kM6GHhpgLCUscuABbzkD2ZbJ2fneYryaZ6Ch7fFU  (github.com/VeiloSolana/privacy-program)
Pipeline executed (Solana-adapted):
1. FETCH   -> repo/ (14.5k LOC Anchor)
2. STATIC  -> static/ (grep-lints, zk_surface, summary)  [ran live via scripts/static-scan.sh]
3-8 ANALYZE/DEVIL/POC/REPORT -> findings.json, survivors_devil.md, research_context.md, pocs/, poc_review_report.md, report_veilo.md
VERDICT: contract + transaction circuit SOUND; no payable critical. 3 sub-critical (F1 swap_data_hash MED, F2 partial-close lock LOW, F3 EMBER LOW). Swap circuit artifacts unreachable (hunt ongoing).
