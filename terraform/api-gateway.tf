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
}

# Permissions
resource "aws_lambda_permission" "allow_write" {
  statement_id  = "AllowWriteInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.write_log.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_fetch" {
  statement_id  = "AllowFetchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fetch_logs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# Integrations
resource "aws_apigatewayv2_integration" "write_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.write_log.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "fetch_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fetch_logs.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Routes
resource "aws_apigatewayv2_route" "write_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /log"
  target    = "integrations/${aws_apigatewayv2_integration.write_integration.id}"
}

resource "aws_apigatewayv2_route" "fetch_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /log"
  target    = "integrations/${aws_apigatewayv2_integration.fetch_integration.id}"
}

# More CORS configuration

