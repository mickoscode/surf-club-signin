
# -----------------------------------------------------------
# CloudFront Distribution 
# This CDN will serve your content and enforce HTTPS using the ACM certificate.
# -----------------------------------------------------------
resource "aws_cloudfront_distribution" "cdn" {
  # This 'depends_on' block ensures that this resource is not created until
  # after the ACM certificate has been validated and is in a ready state.
  depends_on = [aws_acm_certificate.cert]

  origin {
    domain_name = aws_s3_bucket_website_configuration.public_bucket_website.website_endpoint
    origin_id   = "S3-Origin"

    custom_origin_config {
      origin_protocol_policy   = "http-only"
      http_port                = 80
      https_port               = 443
      origin_keepalive_timeout = 5
      origin_read_timeout      = 30
      origin_ssl_protocols     = ["SSLv3", "TLSv1", "TLSv1.1", "TLSv1.2"]
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

  # TODO - my cloud front distro is old, using classic and needs to be upgraded before this will work!
  # Attach the WAFv2 Web ACL to the CloudFront distribution (defined in api-gateway.tf)
  #web_acl_id = aws_wafv2_web_acl.api_rate_limit_acl.arn
  web_acl_id = aws_waf_web_acl.api_acl.arn
}

# CLASSIC compatible rate limiting:
resource "aws_waf_ipset" "api_ip_set" {
  name = "api-ip-set"

  ip_set_descriptors {
    type  = "IPV4"
    value = "0.0.0.0/8" # Match all IPv4 addresses
  }
}

resource "aws_waf_rate_based_rule" "api_rate_limit" {
  name        = "api-rate-limit"
  metric_name = "ApiRateLimit"
  rate_key    = "IP"
  rate_limit  = 100 # 100 is the min value

  predicates {
    data_id = aws_waf_ipset.api_ip_set.id
    negated = false
    type    = "IPMatch"
  }
}

resource "aws_waf_web_acl" "api_acl" {
  name        = "api-acl"
  metric_name = "ApiACL"

  default_action {
    type = "ALLOW"
  }

  rules {
    action {
      type = "BLOCK"
    }

    priority = 1
    rule_id  = aws_waf_rate_based_rule.api_rate_limit.id
    type     = "RATE_BASED"
  }
}
