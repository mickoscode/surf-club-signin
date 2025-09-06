variable "lambda_names" {
  type    = list(string)
  default = ["WriteBulkLogsFunction", "EditNameFunction", "WriteNameFunction", "WriteLogFunction", "FetchLogsFunction", "FetchNamesFunction", "FetchDatesFunction"]
}

resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each          = toset(var.lambda_names)
  name              = "/aws/lambda/${each.value}"
  retention_in_days = 7
}

# Note: 
# Because the logs are auto-created by AWS when the lambdas were created,
# I had to import these resources before log retention could be changed from 0 (forever) to 7 days

#import {
#to = aws_cloudwatch_log_group.lambda_logs["WriteBulkLogsFunction"]
#id = "/aws/lambda/WriteBulkLogsFunction"
#}

#import {
#to = aws_cloudwatch_log_group.lambda_logs["EditNameFunction"]
#id = "/aws/lambda/EditNameFunction"
#}

#import {
#to = aws_cloudwatch_log_group.lambda_logs["WriteNameFunction"]
#id = "/aws/lambda/WriteNameFunction"
#}

#import {
#to = aws_cloudwatch_log_group.lambda_logs["WriteLogFunction"]
#id = "/aws/lambda/WriteLogFunction"
#}

#import {
#to = aws_cloudwatch_log_group.lambda_logs["FetchLogsFunction"]
#id = "/aws/lambda/FetchLogsFunction"
#}

#import {
#to = aws_cloudwatch_log_group.lambda_logs["FetchNamesFunction"]
#id = "/aws/lambda/FetchNamesFunction"
#}

#import {
#to = aws_cloudwatch_log_group.lambda_logs["FetchDatesFunction"]
#id = "/aws/lambda/FetchDatesFunction"
#}