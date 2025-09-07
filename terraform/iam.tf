# -------------------------------
# Access for Github workflows
# -------------------------------
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

# -------------------------------
# IAM Role for Lambda
# -------------------------------
resource "aws_iam_role" "lambda_role" {
  name = "LogLambdaExecutionRole"

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

resource "aws_iam_policy" "lambda_policy" {
  name = "LogLambdaPolicy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DescribeTable",
          "dynamodb:Query"
        ],
        Resource = [
          aws_dynamodb_table.log.arn,
          aws_dynamodb_table.activity.arn,
          aws_dynamodb_table.names.arn,
          #"${aws_dynamodb_table.names.arn}/index/activity_id"  # For GSI access
        ]
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        # TODO - tighten this to something like... 
        # "Resource": "arn:aws:logs:ap-southeast-2:YOUR_ACCOUNT_ID:log-group:/aws/lambda/EditNameFunction:*"
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}
