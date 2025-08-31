# -------------------------------
# Lambda - Write Bulk Logs
# -------------------------------
data "archive_file" "write_bulk_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_write_bulk_logs"
  output_path = "${path.module}/write_bulk.zip"
}

resource "aws_lambda_function" "write_bulk" {
  function_name    = "WriteBulkLogsFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.write_bulk_zip.output_path
  source_code_hash = data.archive_file.write_bulk_zip.output_base64sha256
}

# -------------------------------
# Lambda - Edit Name
# -------------------------------
data "archive_file" "edit_name_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_edit_name"
  output_path = "${path.module}/edit_name.zip"
}

resource "aws_lambda_function" "edit_name" {
  function_name    = "EditNameFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.edit_name_zip.output_path
  source_code_hash = data.archive_file.edit_name_zip.output_base64sha256
}

# -------------------------------
# Lambda - Write Name
# -------------------------------
data "archive_file" "write_name_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_write_name"
  output_path = "${path.module}/write_name.zip"
}

resource "aws_lambda_function" "write_name" {
  function_name    = "WriteNameFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.write_name_zip.output_path
  source_code_hash = data.archive_file.write_name_zip.output_base64sha256
}

# -------------------------------
# Lambda - Write Log
# -------------------------------
data "archive_file" "write_log_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_write_log"
  output_path = "${path.module}/write_log.zip"
}

resource "aws_lambda_function" "write_log" {
  function_name    = "WriteLogFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.write_log_zip.output_path
  source_code_hash = data.archive_file.write_log_zip.output_base64sha256
}

# -------------------------------
# Lambda - Fetch Logs
# -------------------------------
data "archive_file" "fetch_logs_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_fetch_logs"
  output_path = "${path.module}/fetch_logs.zip"
}

resource "aws_lambda_function" "fetch_logs" {
  function_name    = "FetchLogsFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.fetch_logs_zip.output_path
  source_code_hash = data.archive_file.fetch_logs_zip.output_base64sha256
}

# -------------------------------
# Lambda - Fetch Names
# -------------------------------
data "archive_file" "fetch_names_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_fetch_names"
  output_path = "${path.module}/fetch_names.zip"
}

resource "aws_lambda_function" "fetch_names" {
  function_name    = "FetchNamesFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.fetch_names_zip.output_path
  source_code_hash = data.archive_file.fetch_names_zip.output_base64sha256
}

# -------------------------------
# Lambda - Fetch Dates
# -------------------------------
data "archive_file" "fetch_dates_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_fetch_dates"
  output_path = "${path.module}/fetch_dates.zip"
}

resource "aws_lambda_function" "fetch_dates" {
  function_name    = "FetchDatesFunction"
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.fetch_dates_zip.output_path
  source_code_hash = data.archive_file.fetch_dates_zip.output_base64sha256
}
 