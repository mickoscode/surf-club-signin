resource "aws_iam_user" "mickos_github" {
  name = "mickos-github"
}

resource "aws_iam_policy" "mickos_github_s3_write_policy" {
  name        = "mickos-github-s3-write-policy"
  description = "Policy to allow write and delete access to the S3 bucket mickos-surf-club-website"
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
          "arn:aws:s3:::micko-training2025.info",
          "arn:aws:s3:::micko-training2025.info/*"
        ]
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "mickos_github_policy_attachment" {
  user       = aws_iam_user.mickos_github.name
  policy_arn = aws_iam_policy.mickos_github_s3_write_policy.arn
}

resource "aws_iam_user" "surf_club_lambda" {
  name = "surf-club-lambda"
}

resource "aws_iam_policy" "surf_club_lambda_s3_write_policy" {
  name        = "surf-club-lambda-s3-write-policy"
  description = "Policy to allow write and delete access to the S3 bucket mickos-surf-club-website"
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
          "arn:aws:s3:::micko-training2025.info-data",
          "arn:aws:s3:::micko-training2025.info-data/*"
        ]
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "surf_club_lambda_policy_attachment" {
  user       = aws_iam_user.surf_club_lambda.name
  policy_arn = aws_iam_policy.surf_club_lambda_s3_write_policy.arn
}