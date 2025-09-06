# Request an SSL certificate for your domain. This must be done in us-east-1
# -----------------------------------------------------------
resource "aws_acm_certificate" "domain2" {
  provider          = aws.us-east-1
  domain_name       = var.bucket_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}
