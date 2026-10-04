# -------------------------------
# API Gateway
# -------------------------------
resource "aws_apigatewayv2_api" "api" {
  name          = "LogAPI"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # Throttling applies to the whole stage (all clients together), not per IP. Requests over
  # the limit get HTTP 429. Limits are set well above a busy sign-in window; see variables.tf.
  default_route_settings {
    throttling_rate_limit  = var.api_throttle_rate_limit
    throttling_burst_limit = var.api_throttle_burst_limit
  }
}

# -------------------------------
# Permissions
# -------------------------------
resource "aws_lambda_permission" "lambda" {
  for_each      = local.lambdas
  statement_id  = each.value.statement_id
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# -------------------------------
# Integrations
# -------------------------------
resource "aws_apigatewayv2_integration" "lambda" {
  for_each               = local.lambdas
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.lambda[each.key].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# -------------------------------
# Routes
# -------------------------------
resource "aws_apigatewayv2_route" "lambda" {
  for_each  = local.lambda_routes
  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value].id}"
}
