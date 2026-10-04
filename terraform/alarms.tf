# -------------------------------
# Alarms: tell me when sign-in is failing
# -------------------------------
# The Lambdas catch their own exceptions and return HTTP 500, so the API 5xx alarm is the one
# that catches handled failures; the Lambda Errors alarm catches crashes and timeouts that never
# produce a response. Alarms email var.budget_alert_email through SNS (confirm the subscription
# email once after the first apply).
resource "aws_sns_topic" "alerts" {
  name = "surf-club-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.budget_alert_email
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "api-5xx-errors"
  alarm_description   = "The sign-in API returned server errors (HTTP 5xx)."
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ApiId = aws_apigatewayv2_api.api.id
    Stage = aws_apigatewayv2_stage.default.name
  }
}

# No FunctionName dimension: this sums errors across every Lambda in the region, which is all of them.
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "lambda-errors"
  alarm_description   = "A Lambda function crashed or timed out."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
