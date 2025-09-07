
# -----------------------------------------------------------
# Request an SSL certificate for your domain/bucket. Must be done in us-east-1
# -----------------------------------------------------------
resource "aws_acm_certificate" "domain2" {
  provider          = aws.us-east-1
  domain_name       = var.bucket_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------
# CloudFront Distribution to serve content and enforce HTTPS using the ACM certificate.
# -----------------------------------------------------------
resource "aws_cloudfront_distribution" "sio" {
  # This 'depends_on' block ensures that this resource is not created until
  # after the ACM certificate has been validated and is in a ready state.
  depends_on = [aws_acm_certificate.domain2]

  web_acl_id = aws_wafv2_web_acl.sio_api_rate_limit.arn

  origin {
    domain_name = aws_s3_bucket_website_configuration.sio.website_endpoint
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

  aliases = [aws_s3_bucket.sio.bucket]

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

  custom_error_response {
    error_caching_min_ttl = 10
    error_code            = 404
    response_code         = 404
    response_page_path    = "/about.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate.domain2.arn
    ssl_support_method             = "sni-only"
  }

  tags = {
    Name = "${aws_s3_bucket.sio.bucket}-cdn"
  }
}


# This rule blocks any IP that exceeds 20 requests in a 5-minute window (WAF’s default granularity)
resource "aws_wafv2_web_acl" "sio_api_rate_limit" {
  provider    = aws.us-east-1
  name        = "api-rate-limit-acl"
  description = "Rate limit API access to 20 requests per hour"
  scope       = "CLOUDFRONT" # Required for CloudFront

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-ip"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 20
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "apiRateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "apiWebACL"
    sampled_requests_enabled   = true
  }
}
