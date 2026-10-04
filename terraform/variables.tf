variable "aws_account_id" {
  description = "AWS account ID used for resource ARNs"
  type        = string
  validation {
    condition     = can(regex("^\\d{12}$", var.aws_account_id))
    error_message = "AWS account ID must be a 12-digit number."
  }
}

variable "cloudfront_dist_id" {
  description = "CloudFront distribution ID"
  type        = string
  validation {
    condition     = length(var.cloudfront_dist_id) > 0
    error_message = "CloudFront distribution ID must not be empty."
  }
}

variable "iam_user_cli" {
  description = "IAM user name for CLI access"
  type        = string
  validation {
    condition     = length(var.iam_user_cli) > 0
    error_message = "IAM user name must not be empty."
  }
}

variable "bucket_name" {
  description = "S3 bucket name"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9.-]{3,63}$", var.bucket_name))
    error_message = "Bucket name must be 3–63 characters, lowercase, and valid for S3."
  }
}

variable "github_repo" {
  description = "GitHub repository (owner/name) allowed to assume the deploy role"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9-]{1,39}/[a-zA-Z0-9._-]+$", var.github_repo))
    error_message = "GitHub repository must be in the form owner/name."
  }
}

variable "api_throttle_rate_limit" {
  description = "Steady-state requests per second allowed across the whole API stage"
  type        = number
  default     = 50
  validation {
    condition     = var.api_throttle_rate_limit >= 1
    error_message = "Rate limit must be at least 1 request per second."
  }
}

variable "api_throttle_burst_limit" {
  description = "Maximum burst of concurrent requests allowed across the whole API stage"
  type        = number
  default     = 100
  validation {
    condition     = var.api_throttle_burst_limit >= 1
    error_message = "Burst limit must be at least 1."
  }
}

variable "budget_alert_email" {
  description = "Email address that receives AWS Budget alerts. Set as a sensitive HCP Terraform workspace variable, not in tfvars."
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_alert_email))
    error_message = "Budget alert email must be a valid email address."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget in USD; alerts fire as spend approaches it"
  type        = number
  default     = 5
  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "Monthly budget must be greater than zero."
  }
}

variable "csp_enforce" {
  description = "true = send the Content-Security-Policy header (blocks violations); false = send it as Report-Only (browsers only log violations to the console)."
  type        = bool
  default     = false
}
