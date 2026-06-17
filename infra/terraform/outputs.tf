output "server_ipv4" {
  description = "Public IPv4 of the app server."
  value       = hcloud_server.app.ipv4_address
}

output "server_status" {
  value = hcloud_server.app.status
}

output "next_steps" {
  value = "Point DNS at ${hcloud_server.app.ipv4_address}, then the cloud-init brings up docker compose. See infra/terraform/README.md."
}
