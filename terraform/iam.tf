# -------------------------------
# Access for Github workflows (policy; attached to the OIDC role below)
# -------------------------------
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

# -------------------------------
# Access for Github workflows via OIDC (no long-lived keys)
# -------------------------------
# NOTE: an account can only have one OIDC provider per URL. If one for
# token.actions.githubusercontent.com already exists, import it instead:
#   terraform import aws_iam_openid_connect_provider.github arn:aws:iam::<acct>:oidc-provider/token.actions.githubusercontent.com
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github_deploy" {
  name                 = "github-deploy-role"
  description          = "Assumed by GitHub Actions (main branch only) to deploy the site"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = aws_iam_policy.github_s3_write.arn
}

# -------------------------------
# IAM roles for Lambda (one least-privilege role per function)
# -------------------------------
# Each function gets its own role that can only (a) run the DynamoDB actions it uses against the
# one table it uses, and (b) write to its own CloudWatch log group. Nothing else.
# Log groups are managed in cloudwatch.tf, so logs:CreateLogGroup is deliberately not granted.
data "aws_region" "current" {}

locals {
  lambda_access = {
    WriteBulkLogsFunction = { table = aws_dynamodb_table.log.arn, actions = ["dynamodb:PutItem"] }
    WriteLogFunction      = { table = aws_dynamodb_table.log.arn, actions = ["dynamodb:PutItem"] }
    FetchLogsFunction     = { table = aws_dynamodb_table.log.arn, actions = ["dynamodb:Query"] }
    FetchUserLogsFunction = { table = aws_dynamodb_table.log.arn, actions = ["dynamodb:Query"] }
    FetchDatesFunction    = { table = aws_dynamodb_table.log.arn, actions = ["dynamodb:Query"] }
    FetchNamesFunction    = { table = aws_dynamodb_table.names.arn, actions = ["dynamodb:Query"] }
    WriteNameFunction     = { table = aws_dynamodb_table.names.arn, actions = ["dynamodb:PutItem"] }
    EditNameFunction      = { table = aws_dynamodb_table.names.arn, actions = ["dynamodb:UpdateItem"] }
  }
}

resource "aws_iam_role" "lambda" {
  for_each = local.lambda_access
  name     = "${each.key}Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  for_each = local.lambda_access
  name     = "${each.key}Access"
  role     = aws_iam_role.lambda[each.key].id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid      = "DynamoDBAccess"
        Effect   = "Allow",
        Action   = each.value.actions,
        Resource = [each.value.table]
      },
      {
        Sid    = "OwnLogGroupOnly"
        Effect = "Allow",
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:${data.aws_region.current.region}:${var.aws_account_id}:log-group:/aws/lambda/${each.key}:*"
      }
    ]
  })
}
