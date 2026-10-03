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
