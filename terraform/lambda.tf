# -------------------------------
# Lambda functions
# -------------------------------
# One entry per function. This map drives the zip, function, API Gateway permission, integration
# and routes (see api-gateway.tf). Per-function IAM permissions live in lambda_access (iam.tf), and
# log groups come from these keys (cloudwatch.tf), so a new function needs an entry here and in
# lambda_access. OPTIONS routes are needed for CORS on the POST endpoints.
locals {
  lambdas = {
    WriteBulkLogsFunction = { dir = "lambda_write_bulk_logs", zip = "write_bulk", timeout = 10, statement_id = "AllowWriteInvoke", routes = ["POST /bulk", "OPTIONS /bulk"] }
    EditNameFunction      = { dir = "lambda_edit_name", zip = "edit_name", timeout = 5, statement_id = "AllowFetchInvoke", routes = ["POST /editname", "OPTIONS /editname"] }
    WriteNameFunction     = { dir = "lambda_write_name", zip = "write_name", timeout = 5, statement_id = "AllowFetchInvoke", routes = ["POST /addname", "OPTIONS /addname"] }
    WriteLogFunction      = { dir = "lambda_write_log", zip = "write_log", timeout = 5, statement_id = "AllowWriteInvoke", routes = ["POST /log", "OPTIONS /log"] }
    FetchLogsFunction     = { dir = "lambda_fetch_logs", zip = "fetch_logs", timeout = 5, statement_id = "AllowFetchInvoke", routes = ["GET /log"] }
    FetchUserLogsFunction = { dir = "lambda_fetch_user_logs", zip = "fetch_user_logs", timeout = 5, statement_id = "AllowFetchInvoke", routes = ["GET /userlog"] }
    FetchNamesFunction    = { dir = "lambda_fetch_names", zip = "fetch_names", timeout = 5, statement_id = "AllowFetchInvoke", routes = ["GET /name"] }
    FetchDatesFunction    = { dir = "lambda_fetch_dates", zip = "fetch_dates", timeout = 5, statement_id = "AllowFetchInvoke", routes = ["GET /date"] }
  }

  # route key (e.g. "POST /bulk") => function name
  lambda_routes = merge([for name, cfg in local.lambdas : { for route in cfg.routes : route => name }]...)
}

data "archive_file" "lambda" {
  for_each    = local.lambdas
  type        = "zip"
  source_dir  = "${path.module}/${each.value.dir}"
  output_path = "${path.module}/${each.value.zip}.zip"
}

resource "aws_lambda_function" "lambda" {
  for_each         = local.lambdas
  function_name    = each.key
  timeout          = each.value.timeout
  role             = aws_iam_role.lambda[each.key].arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda[each.key].output_path
  source_code_hash = data.archive_file.lambda[each.key].output_base64sha256
}
