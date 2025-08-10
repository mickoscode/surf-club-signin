
# Request an SSL certificate for your domain. This must be done in us-east-3.
# -----------------------------------------------------------
resource "aws_acm_certificate" "cert" {
  provider          = aws.us-east-1
  domain_name       = "micko-training2023.info"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# We create an Origin Access Identity (OAI) for CloudFront.
# This OAI acts as a "virtual user" to securely access your public bucket.
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for micko-training2023.info"
}

# The bucket policy grants the OAI permission to read objects from the bucket
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
