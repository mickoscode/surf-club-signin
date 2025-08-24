# Terraform error to resolve

 ```
 Error: creating WAF Web ACL (api-acl): operation error WAF: CreateWebACL, https response error StatusCode: 400, RequestID: 09d8fcde-8875-423b-9a05-22a60f6d96d4, WAFBadRequestException: AWS WAF Classic (v1) support will end on September 30, 2025. Effective May 1st, 2025, the creation of new WebACL v1 is no longer permitted.
│
│   with aws_waf_web_acl.api_acl,
│   on cloud_front.tf line 95, in resource "aws_waf_web_acl" "api_acl":
│   95: resource "aws_waf_web_acl" "api_acl" {
│
╵
Operation failed: failed running terraform apply (exit 1)
```

Since CloudFront doesn’t support in-place upgrades from “classic” to “modern” distributions, you’ll need to:
- Create a new CloudFront distribution using Terraform.
- Migrate your config (origins, behaviors, SSL, etc.).
- Attach the WAFv2 Web ACL via web_acl_id.
- Swap DNS / aliases once validated.

## Create a new CloudFront distribution
Use the same aws_cloudfront_distribution resource, but ensure:
- You don’t reuse the old distribution ID.
- You attach the WAFv2 ACL using web_acl_id.

```hcl
resource "aws_cloudfront_distribution" "cdn_v2" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Upgraded CloudFront distribution with WAFv2"
  default_root_object = "index.html"

  web_acl_id = aws_wafv2_web_acl.api_acl.arn  # ✅ WAFv2 attachment

  aliases = ["your.domain.com"]

  origin {
    domain_name = aws_s3_bucket_website_configuration.public_bucket_website.website_endpoint
    origin_id   = "S3-Origin"

    custom_origin_config {
      origin_protocol_policy   = "http-only"
      http_port                = 80
      https_port               = 443
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_keepalive_timeout = 5
      origin_read_timeout      = 30
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-Origin"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  viewer_certificate {
    acm_certificate_arn            = aws_acm_certificate.cert.arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Environment = "production"
  }

  depends_on = [aws_acm_certificate.cert]
}
```

## Validate and Swap DNS
Once deployed:
- Validate the new distribution works as expected.
- Update your DNS (e.g. Route 53) to point your domain to the new distribution.
- Optionally delete the old one once traffic is stable
