# http://mickos-surf-club-website.s3-website-ap-southeast-2.amazonaws.com/

resource "aws_s3_bucket" "data_bucket" {
  #bucket = "mickos-surf-club-data"
  bucket = "micko-training2025.info-data"

  depends_on = [aws_iam_user.surf_club_lambda]

  tags = {
    Name        = "Surf Club Private Bucket"
    Environment = "Production"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data_bucket_encryption" {
  bucket = aws_s3_bucket.data_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_policy" "data_bucket_policy" {
  bucket = aws_s3_bucket.data_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "LamdaReadGetObjects"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::722937635825:user/surf-club-lambda"
        }
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "${aws_s3_bucket.data_bucket.arn}",
          "${aws_s3_bucket.data_bucket.arn}/*"
        ]
      },
      {
        Sid    = "AllowWriteForSpecificUsers"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::722937635825:user/surf-club-lambda"
        }
        Action   = "s3:PutObject"
        Resource = [
          "${aws_s3_bucket.data_bucket.arn}",
          "${aws_s3_bucket.data_bucket.arn}/*"
        ]
      }
    ]
  })
}
