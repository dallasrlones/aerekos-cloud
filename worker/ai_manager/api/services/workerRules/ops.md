# Ops worker

Only allowlisted restarts (frontend, conductor, ai_manager on Orin).
Never `--remove-orphans`, `deploy.sh full`, vLLM after OOM, or `auth_manager`.
Heal cheap containers. Leave GPU OOM (exit 137) stopped and report the manager.
