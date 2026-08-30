# ADR 002 — Fleet VPC is Headscale

Status: accepted

Devices join one Headscale mesh by default (`tag:worker`). Extra VPCs are ACL tags. Containers use per-project Docker bridges (`network_manager`). No Tailscale SaaS. Public HTTPS stays Cloudflare.
