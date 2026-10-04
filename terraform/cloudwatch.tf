resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each          = toset(keys(local.lambdas))
  name              = "/aws/lambda/${each.value}"
  retention_in_days = 7
}
