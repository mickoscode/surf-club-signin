resource "aws_iam_user" "github_user" {
  name = var.iam_user_github
}

resource "aws_iam_policy" "github_s3_write" {
  name        = "github-s3-write-policy"
  description = "Policy to allow write and delete access to the website S3 bucket"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowWriteAndDeleteToBucket"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.bucket_name}",
          "arn:aws:s3:::${var.bucket_name}/*"
        ]
      },
      {
        Sid    = "AllowCloudFrontInvalidation"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation"
        ]
        Resource = "arn:aws:cloudfront::${var.aws_account_id}:distribution/${var.cloudfront_dist_id}"
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "github" {
  user       = aws_iam_user.github_user.name
  policy_arn = aws_iam_policy.github_s3_write.arn
}
