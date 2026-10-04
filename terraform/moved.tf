# State moves for the for_each refactor of the Lambda/API resources, so Terraform renames the
# existing resources instead of destroying and recreating them. Safe to delete once applied.

moved {
  from = aws_lambda_function.write_bulk
  to   = aws_lambda_function.lambda["WriteBulkLogsFunction"]
}

moved {
  from = aws_lambda_permission.write_bulk
  to   = aws_lambda_permission.lambda["WriteBulkLogsFunction"]
}

moved {
  from = aws_apigatewayv2_integration.write_bulk
  to   = aws_apigatewayv2_integration.lambda["WriteBulkLogsFunction"]
}

moved {
  from = aws_apigatewayv2_route.write_bulk
  to   = aws_apigatewayv2_route.lambda["POST /bulk"]
}

moved {
  from = aws_apigatewayv2_route.write_bulk_options
  to   = aws_apigatewayv2_route.lambda["OPTIONS /bulk"]
}

moved {
  from = aws_lambda_function.edit_name
  to   = aws_lambda_function.lambda["EditNameFunction"]
}

moved {
  from = aws_lambda_permission.edit_name
  to   = aws_lambda_permission.lambda["EditNameFunction"]
}

moved {
  from = aws_apigatewayv2_integration.edit_name
  to   = aws_apigatewayv2_integration.lambda["EditNameFunction"]
}

moved {
  from = aws_apigatewayv2_route.edit_name
  to   = aws_apigatewayv2_route.lambda["POST /editname"]
}

moved {
  from = aws_apigatewayv2_route.edit_name_options
  to   = aws_apigatewayv2_route.lambda["OPTIONS /editname"]
}

moved {
  from = aws_lambda_function.write_name
  to   = aws_lambda_function.lambda["WriteNameFunction"]
}

moved {
  from = aws_lambda_permission.write_name
  to   = aws_lambda_permission.lambda["WriteNameFunction"]
}

moved {
  from = aws_apigatewayv2_integration.write_name
  to   = aws_apigatewayv2_integration.lambda["WriteNameFunction"]
}

moved {
  from = aws_apigatewayv2_route.write_name
  to   = aws_apigatewayv2_route.lambda["POST /addname"]
}

moved {
  from = aws_apigatewayv2_route.write_name_options
  to   = aws_apigatewayv2_route.lambda["OPTIONS /addname"]
}

moved {
  from = aws_lambda_function.write_log
  to   = aws_lambda_function.lambda["WriteLogFunction"]
}

moved {
  from = aws_lambda_permission.write_log
  to   = aws_lambda_permission.lambda["WriteLogFunction"]
}

moved {
  from = aws_apigatewayv2_integration.write_log
  to   = aws_apigatewayv2_integration.lambda["WriteLogFunction"]
}

moved {
  from = aws_apigatewayv2_route.write_log
  to   = aws_apigatewayv2_route.lambda["POST /log"]
}

moved {
  from = aws_apigatewayv2_route.write_log_options
  to   = aws_apigatewayv2_route.lambda["OPTIONS /log"]
}

moved {
  from = aws_lambda_function.fetch_logs
  to   = aws_lambda_function.lambda["FetchLogsFunction"]
}

moved {
  from = aws_lambda_permission.fetch_logs
  to   = aws_lambda_permission.lambda["FetchLogsFunction"]
}

moved {
  from = aws_apigatewayv2_integration.fetch_logs
  to   = aws_apigatewayv2_integration.lambda["FetchLogsFunction"]
}

moved {
  from = aws_apigatewayv2_route.fetch_logs
  to   = aws_apigatewayv2_route.lambda["GET /log"]
}

moved {
  from = aws_lambda_function.fetch_user_logs
  to   = aws_lambda_function.lambda["FetchUserLogsFunction"]
}

moved {
  from = aws_lambda_permission.fetch_user_logs
  to   = aws_lambda_permission.lambda["FetchUserLogsFunction"]
}

moved {
  from = aws_apigatewayv2_integration.fetch_user_logs
  to   = aws_apigatewayv2_integration.lambda["FetchUserLogsFunction"]
}

moved {
  from = aws_apigatewayv2_route.fetch_user_logs
  to   = aws_apigatewayv2_route.lambda["GET /userlog"]
}

moved {
  from = aws_lambda_function.fetch_names
  to   = aws_lambda_function.lambda["FetchNamesFunction"]
}

moved {
  from = aws_lambda_permission.fetch_names
  to   = aws_lambda_permission.lambda["FetchNamesFunction"]
}

moved {
  from = aws_apigatewayv2_integration.fetch_names
  to   = aws_apigatewayv2_integration.lambda["FetchNamesFunction"]
}

moved {
  from = aws_apigatewayv2_route.fetch_names
  to   = aws_apigatewayv2_route.lambda["GET /name"]
}

moved {
  from = aws_lambda_function.fetch_dates
  to   = aws_lambda_function.lambda["FetchDatesFunction"]
}

moved {
  from = aws_lambda_permission.fetch_dates
  to   = aws_lambda_permission.lambda["FetchDatesFunction"]
}

moved {
  from = aws_apigatewayv2_integration.fetch_dates
  to   = aws_apigatewayv2_integration.lambda["FetchDatesFunction"]
}

moved {
  from = aws_apigatewayv2_route.fetch_dates
  to   = aws_apigatewayv2_route.lambda["GET /date"]
}
