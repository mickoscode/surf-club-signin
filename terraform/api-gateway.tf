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
# ACL Rule to Rate Limit APIs
# TODO - my cloud front distro is old, using classic and needs to be upgraded before this will work!
# -------------------------------
resource "aws_wafv2_web_acl" "api_rate_limit_acl" {
  count       = 0 # Disbale until CF is upgraded from classic
  name        = "api-rate-limit-acl"
  description = "Rate limit API access to 20 requests per hour"
  scope       = "CLOUDFRONT" # Use "REGIONAL" for ALB or API Gateway

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-signin-users"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 20
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "apiRateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "apiWebACL"
    sampled_requests_enabled   = true
  }
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

# -------------------------------
# Routes for Names Table
# -------------------------------
resource "aws_apigatewayv2_route" "fetch_names" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /name"
  target    = "integrations/${aws_apigatewayv2_integration.fetch_names.id}"
}

# -------------------------------
# Routes for Dates from Log Table
# -------------------------------
resource "aws_apigatewayv2_route" "fetch_dates" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /date"
  target    = "integrations/${aws_apigatewayv2_integration.fetch_dates.id}"
}
