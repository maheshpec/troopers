# Infrastructure as Code for the self-hosted option (HOSTING.md Stack C):
# a single hardened Hetzner Cloud VM running the app + observability via the
# docker-compose stack. Cheapest production path (~$5/mo).
#
# ponytail: this codifies the VM + firewall + DNS only. The managed option
# (HOSTING.md Stack A: Supabase + Cloudflare) needs no server IaC — its
# equivalent "infra as code" is the GitHub Actions cron + Supabase project
# config. Pick one path per environment; do not run both.

terraform {
  required_version = ">= 1.6"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.48"
    }
  }
  # ponytail: local state for now. Upgrade path -> remote backend (e.g. an S3/R2
  # bucket) before more than one person runs terraform.
}

provider "hcloud" {
  token = var.hcloud_token # from HCLOUD_TOKEN / TF_VAR_hcloud_token (never committed)
}

# Least-privilege firewall: only SSH (lockable to admin IPs) + HTTP/HTTPS.
resource "hcloud_firewall" "troopers" {
  name = "${var.name}-fw"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = var.ssh_allowed_cidrs
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "app" {
  name        = var.name
  server_type = var.server_type # cax11 = 2 vCPU / 4GB ARM, ~$5/mo
  image       = "docker-ce"     # Docker preinstalled
  location    = var.location
  ssh_keys    = var.ssh_key_names
  firewall_ids = [hcloud_firewall.troopers.id]

  labels = {
    app = "troopers"
    env = var.environment
  }

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    repo_url = var.repo_url
  })
}
