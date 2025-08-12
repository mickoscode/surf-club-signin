# -------------------------------
# Lambda Functions
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
 