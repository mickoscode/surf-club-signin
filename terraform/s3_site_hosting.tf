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

data "aws_iam_policy_document" "s3_policy" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.public_bucket.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
  }

  statement {
    sid       = "AllowWriteforSpecificUsers"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.public_bucket.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::722937635825:user/micko-cli"]
    }
  }

  #OAI permissions for CloudFront to access the bucket
  # possibly not needed now, following update to OAC... but leaving in place for now
  statement {
    sid       = "AllowCloudFrontGet"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.public_bucket.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.oai.iam_arn]
    }
  }

  statement {
    sid       = "AllowCloudFrontList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.public_bucket.arn]

    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.oai.iam_arn]
    }
  }

  # Newer OAC permissions for CloudFront to access the bucket
  # generated via AWS console when cloud front was correctly updated to point to s3 website (instead of s3 api).
  statement {
    sid       = "AllowCloudFrontServicePrincipal1"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.public_bucket.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::722937635825:distribution/E25MMIJS9KLCP2"]
    }
  }
}

resource "aws_s3_bucket_policy" "website_policy" {
  bucket = aws_s3_bucket.public_bucket.id
  policy = data.aws_iam_policy_document.s3_policy.json
}
