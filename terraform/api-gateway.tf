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

# -------------------------------
# Permissions
# -------------------------------
resource "aws_lambda_permission" "write_bulk" {
  statement_id  = "AllowWriteInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.write_bulk.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "write_log" {
  statement_id  = "AllowWriteInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.write_log.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "fetch_logs" {
  statement_id  = "AllowFetchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fetch_logs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "fetch_user_logs" {
  statement_id  = "AllowFetchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fetch_user_logs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "write_name" {
  statement_id  = "AllowFetchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.write_name.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "edit_name" {
  statement_id  = "AllowFetchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.edit_name.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "fetch_names" {
  statement_id  = "AllowFetchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fetch_names.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "fetch_dates" {
  statement_id  = "AllowFetchInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fetch_dates.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# -------------------------------
# Integrations
# -------------------------------
resource "aws_apigatewayv2_integration" "write_bulk" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.write_bulk.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "write_log" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.write_log.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "fetch_logs" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fetch_logs.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "fetch_user_logs" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fetch_user_logs.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "write_name" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.write_name.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "edit_name" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.edit_name.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "fetch_names" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fetch_names.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "fetch_dates" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fetch_dates.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# -------------------------------
# Routes for Log Table
# -------------------------------
resource "aws_apigatewayv2_route" "write_bulk" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /bulk"
  target    = "integrations/${aws_apigatewayv2_integration.write_bulk.id}"
}
# OPTIONS is needed for CORS
resource "aws_apigatewayv2_route" "write_bulk_options" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "OPTIONS /bulk"
  target    = "integrations/${aws_apigatewayv2_integration.write_bulk.id}"
}

resource "aws_apigatewayv2_route" "write_log" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /log"
  target    = "integrations/${aws_apigatewayv2_integration.write_log.id}"
}
# OPTIONS is needed for CORS
resource "aws_apigatewayv2_route" "write_log_options" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "OPTIONS /log"
  target    = "integrations/${aws_apigatewayv2_integration.write_log.id}"
}

resource "aws_apigatewayv2_route" "fetch_logs" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /log"
  target    = "integrations/${aws_apigatewayv2_integration.fetch_logs.id}"
}

resource "aws_apigatewayv2_route" "fetch_user_logs" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /userlog"
  target    = "integrations/${aws_apigatewayv2_integration.fetch_user_logs.id}"
}

# -------------------------------
# Routes for Names Table
# -------------------------------
resource "aws_apigatewayv2_route" "fetch_names" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /name"
  target    = "integrations/${aws_apigatewayv2_integration.fetch_names.id}"
}

resource "aws_apigatewayv2_route" "write_name" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /addname"
  target    = "integrations/${aws_apigatewayv2_integration.write_name.id}"
}
# OPTIONS is needed for CORS
resource "aws_apigatewayv2_route" "write_name_options" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "OPTIONS /addname"
  target    = "integrations/${aws_apigatewayv2_integration.write_name.id}"
}

resource "aws_apigatewayv2_route" "edit_name" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /editname"
  target    = "integrations/${aws_apigatewayv2_integration.edit_name.id}"
}
# OPTIONS is needed for CORS
resource "aws_apigatewayv2_route" "edit_name_options" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "OPTIONS /editname"
  target    = "integrations/${aws_apigatewayv2_integration.edit_name.id}"
}

# -------------------------------
# Routes for Dates from Log Table
# -------------------------------
resource "aws_apigatewayv2_route" "fetch_dates" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /date"
  target    = "integrations/${aws_apigatewayv2_integration.fetch_dates.id}"
}
