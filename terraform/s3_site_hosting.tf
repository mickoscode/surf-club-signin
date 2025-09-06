# SIO = SIGN-IN-OUT :) 
resource "aws_s3_bucket" "sio" {
  bucket = var.bucket_name #must exactly match domain name

  tags = {
    Name        = "Sign-In-Out Public Bucket"
    Environment = "Production"
  }
}

resource "aws_s3_bucket_website_configuration" "sio" {
  bucket = aws_s3_bucket.sio.id

  index_document {
    suffix = "index.html"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "sio" {
  bucket = aws_s3_bucket.sio.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "sio" {
  bucket = aws_s3_bucket.sio.id

  # Explicitly set this to false to allow public policies.
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

data "aws_iam_policy_document" "sio" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.sio.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
  }

  statement {
    sid       = "AllowWriteforSpecificUsers"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.sio.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:user/${var.iam_user_cli}"]
    }
  }

  # Newer OAC permissions for CloudFront to access the bucket
  # generated via AWS console when cloud front was correctly updated to point to s3 website (instead of s3 api).
  statement {
    sid       = "AllowCloudFrontServicePrincipal1"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.sio.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::${var.aws_account_id}:distribution/${var.cloudfront_dist_id}"]
    }
  }
}

resource "aws_s3_bucket_policy" "sio" {
  bucket = aws_s3_bucket.sio.id
  policy = data.aws_iam_policy_document.sio.json
}
