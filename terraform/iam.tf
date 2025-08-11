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



# TODO re-write this...
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


# Role for lamda
resource "aws_iam_role" "lambda_exec_role" {
  name = "LambdaExecutionRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      },
      Action = "sts:AssumeRole"
    }]
  })
}

#TODO - need better s3 structure, so different log files can be used each weekend.
# e.g. bucket/yyyy-mm-dd/in.log
# better still... switch to DynamoDB, given python has to upload a new object for each entry (not simply appending to a file)
resource "aws_iam_policy" "lambda_s3_policy" {
  name        = "LambdaS3Policy"
  description = "Allow Lambda to access S3 and CloudWatch Logs"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "AllowS3Access",
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ],
        Resource = [
          "${aws_s3_bucket.data_bucket.arn}/in.log",
          "${aws_s3_bucket.data_bucket.arn}/out.log"
        ]
      },
      {
        Sid    = "AllowLogging",
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_s3_policy.arn
}
