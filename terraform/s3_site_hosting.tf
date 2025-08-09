# http://mickos-surf-club-website.s3-website-ap-southeast-2.amazonaws.com/

resource "aws_s3_bucket" "public_bucket" {
  bucket = "micko-training2025.info" #must exactly match domain name
  #bucket = "mickos-surf-club-website"

  tags = {
    Name        = "Surf Club Public Bucket"
    Environment = "Production"
  }
}

resource "aws_s3_bucket_website_configuration" "public_bucket_website" {
  bucket = aws_s3_bucket.public_bucket.id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "public_bucket_encryption" {
  bucket = aws_s3_bucket.public_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "my_bucket_public_access_block" {
  bucket = aws_s3_bucket.public_bucket.id

  # Explicitly set this to false to allow public policies.
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_bucket_policy" {
  bucket = aws_s3_bucket.public_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.public_bucket.arn}/*"
      },
      {
        Sid    = "AllowWriteForSpecificUsers"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::722937635825:user/micko-cli"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.public_bucket.arn}/*"
      }
    ]
  })
}

# Request an SSL certificate for your domain. This must be done in us-east-1.
# -----------------------------------------------------------
resource "aws_acm_certificate" "cert" {
  provider          = aws.us-east-1
  domain_name       = "micko-training2025.info"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Output the DNS validation records. This is crucial for Step 1.
output "acm_validation_record" {
  value = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}

# We create an Origin Access Identity (OAI) for CloudFront.
# This OAI acts as a "virtual user" to securely access your S3 bucket.
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for micko-training2025.info"
}

# The bucket policy grants the OAI permission to read objects from the bucket,
# while explicitly denying public read access.
data "aws_iam_policy_document" "s3_policy" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.public_bucket.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.oai.iam_arn]
    }
  }

  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.public_bucket.arn]

    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.oai.iam_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "website_policy" {
  bucket = aws_s3_bucket.public_bucket.id
  policy = data.aws_iam_policy_document.s3_policy.json
}

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

  enabled         = true
  is_ipv6_enabled = true

  aliases = ["micko-training2025.info"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Origin"

    # This is the key setting that redirects all HTTP traffic to HTTPS.
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400

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