data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambdas"
  output_path = "${path.module}/lambdas.zip"
}

resource "aws_lambda_function" "add_log" {
  function_name    = "addLogFunction"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "lambda_handler.lambda_handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}
