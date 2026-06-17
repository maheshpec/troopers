# Terraform — self-hosted VM (HOSTING.md Stack C)

Provisions a single hardened Hetzner Cloud VM (~$5/mo) that runs the full
docker-compose stack (API + Postgres + Prometheus + Grafana + Alertmanager).

> This is the **self-hosted** path. If you chose the managed default
> (HOSTING.md Stack A: Supabase + Cloudflare), you do **not** need Terraform —
> that stack's "IaC" is the Supabase project config + the GitHub Actions crons.

## Use
```bash
export TF_VAR_hcloud_token=...          # never commit
terraform init
terraform plan  -var 'ssh_key_names=["my-key"]'
terraform apply -var 'ssh_key_names=["my-key"]'
```

## Before production
- Lock `ssh_allowed_cidrs` to admin IPs.
- Put TLS (Caddy/Traefik) in front of the API; don't expose Grafana publicly.
- Move Terraform state to a remote backend (R2/S3).
- Inject real secrets (`API_AUTH_TOKENS`, DB creds) via the platform, not the repo.

See `PONYTAIL-DEBT.md` for the deferred hardening items.
