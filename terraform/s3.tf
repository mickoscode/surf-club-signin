resource "aws_s3_bucket" "public_bucket" {
  bucket = "mickos-surf-club-website"
  acl    = "public-read"

  website {
    index_document = "index.html"
  }

  tags = {
    Name        = "Surf Club Public Bucket"
    Environment = "Production"
  }
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
        Sid       = "AllowWriteForSpecificUser"
        Effect    = "Allow"
        Principal = {
          AWS = "arn:aws:iam::722937635825:user/micko-cli"
        }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.public_bucket.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_versioning" "public_bucket_versioning" {
  bucket = aws_s3_bucket.public_bucket.id

  versioning_configuration {
    status = "Suspended"
  }
}