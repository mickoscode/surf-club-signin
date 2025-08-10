
# -----------------------------------------------------------
# CloudFront Distribution 
# This CDN will serve your content and enforce HTTPS using the ACM certificate.
# -----------------------------------------------------------
resource "aws_cloudfront_distribution" "cdn" {
  # This 'depends_on' block ensures that this resource is not created until
  # after the ACM certificate has been validated and is in a ready state.
  depends_on = [aws_acm_certificate.cert]

  origin {
    domain_name = aws_s3_bucket.public_bucket.bucket_regional_domain_name
    origin_id   = "S3-Origin"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  enabled = true
  #is_ipv4_enabled = true  #investigate!

  aliases = ["micko-training2025.info"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Origin"

    # This is the key setting that redirects all HTTP traffic to HTTPS.
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600  # 1 hour
    max_ttl                = 86400 # 24 hours

    forwarded_values {
      query_string = false
      headers      = []
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate.cert.arn
    ssl_support_method             = "sni-only"
  }

  tags = {
    Name = "micko-training2025.info-cdn"
  }
}

# An output value to get the CloudFront domain name, which you will use
# to create a CNAME record in your DNS.
output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.cdn.domain_name
}