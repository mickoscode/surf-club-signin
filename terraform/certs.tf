
# Request an SSL certificate for your domain. This must be done in us-east-3.
# -----------------------------------------------------------
resource "aws_acm_certificate" "cert" {
  provider          = aws.us-east-1
  domain_name       = "micko-training2025.info"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# We create an Origin Access Identity (OAI) for CloudFront.
# This OAI acts as a "virtual user" to securely access your public bucket.
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for micko-training2025.info"
}

# The bucket policy grants the OAI permission to read objects from the bucket
# moved to s3_site_hosting.tf


# Request an SSL certificate for your domain. This must be done in us-east-3.
# -----------------------------------------------------------
resource "aws_acm_certificate" "domain2" {
  provider          = aws.us-east-1
  domain_name       = "sign-in-out.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}
