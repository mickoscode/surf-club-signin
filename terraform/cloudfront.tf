
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
# Security headers added by CloudFront to every response (pages, assets and the 404 page).
# -----------------------------------------------------------

# Content-Security-Policy: the browser only runs scripts and applies styles served from this site
# (no inline code, no CDNs), and only talks to this site, the API and the Auth0 tenant. The pages
# were changed to fit this (no inline scripts, handlers or styles; libraries vendored in web/main/vendor);
# tests/web/csp.test.js keeps it that way.
locals {
  # Auth0 tenant used by the login stub in web/data/index.js (a test checks the two agree).
  auth0_domain = "dev-zpl25b7w2wfbe4ne.us.auth0.com"

  content_security_policy = join("; ", [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:", # data: for the SVG icons inside picnic.min.css
    "connect-src 'self' ${aws_apigatewayv2_api.api.api_endpoint} https://${local.auth0_domain}",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ])
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "sign-in-out-security-headers"
  comment = "Browser security headers for the static site"

  security_headers_config {
    # Tell browsers to only ever use HTTPS for this domain (1 year). No includeSubDomains/preload,
    # which are hard to undo and not needed here.
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }

    # Stop browsers guessing a file's type (blocks script/style served as the wrong type).
    content_type_options {
      override = true
    }

    # Stop other sites embedding this one in a frame (clickjacking).
    frame_options {
      frame_option = "DENY"
      override     = true
    }

    # Send only the origin (not the full URL with query strings) to other sites.
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    # Enforced only when var.csp_enforce is true; otherwise it is sent as Report-Only (see below).
    dynamic "content_security_policy" {
      for_each = var.csp_enforce ? [1] : []
      content {
        content_security_policy = local.content_security_policy
        override                = true
      }
    }
  }

  custom_headers_config {
    # The site uses none of these browser features.
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      override = true
    }

    # Report-Only: browsers log violations to the developer console but block nothing. Used to check the
    # policy against the real site before enforcing it.
    dynamic "items" {
      for_each = var.csp_enforce ? [] : [1]
      content {
        header   = "Content-Security-Policy-Report-Only"
        value    = local.content_security_policy
        override = true
      }
    }
  }
}

# -----------------------------------------------------------
# Redirects for a few addresses (see redirects.js): /age-manager/ -> /am/info.html and /demo-am/ -> the demo in test mode.
# -----------------------------------------------------------
resource "aws_cloudfront_function" "redirects" {
  name    = "${replace(var.bucket_name, ".", "-")}-redirects"
  runtime = "cloudfront-js-2.0"
  comment = "Redirects for moved or bare addresses"
  publish = true
  code    = file("${path.module}/redirects.js")
}

# -----------------------------------------------------------
# CloudFront Distribution to serve content and enforce HTTPS using the ACM certificate.
# -----------------------------------------------------------
resource "aws_cloudfront_distribution" "sio" {
  # This 'depends_on' block ensures that this resource is not created until
  # after the ACM certificate has been validated and is in a ready state.
  depends_on = [aws_acm_certificate.domain2]

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

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.redirects.arn
    }

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
    response_page_path    = "/404.html"
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
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name = "${aws_s3_bucket.sio.bucket}-cdn"
  }
}
