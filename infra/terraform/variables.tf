variable "hcloud_token" {
  description = "Hetzner Cloud API token (set via TF_VAR_hcloud_token)."
  type        = string
  sensitive   = true
}

variable "name" {
  description = "Server + resource name prefix."
  type        = string
  default     = "troopers"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "server_type" {
  description = "Hetzner server type. cax11 is the cheapest 4GB ARM box."
  type        = string
  default     = "cax11"
}

variable "location" {
  type    = string
  default = "nbg1"
}

variable "ssh_key_names" {
  description = "Names of SSH keys already uploaded to the Hetzner project."
  type        = list(string)
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to SSH. Lock to admin IPs in production."
  type        = list(string)
  default     = ["0.0.0.0/0", "::/0"]
}

variable "repo_url" {
  description = "Git URL cloned by cloud-init to bring up the stack."
  type        = string
  default     = "https://github.com/maheshpec/troopers.git"
}
