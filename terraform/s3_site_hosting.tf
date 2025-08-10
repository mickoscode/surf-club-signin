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
