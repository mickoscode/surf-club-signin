# Enable DynamoDB Free Tier: Use on-demand billing
locals {
  billing_mode = "PAY_PER_REQUEST"
  activity_id  = "sorrento_youth_sunday"
}

# ensure name_id is sanitised 
# and use a separate column (if needed) for name_display
# -------------------------------
# 📘 Table: Names
# -------------------------------
resource "aws_dynamodb_table" "names" {
  name         = "names"
  billing_mode = local.billing_mode
  hash_key     = "activity_id"
  range_key    = "name_id"

  # partition key - because it is listed 1st
  attribute {
    name = "activity_id"
    type = "S"
  }

  # sort/range key - beacuse it is listed 2nd
  attribute {
    name = "name_id"
    type = "S"
  }

  # GSI
  #  global_secondary_index {
  #    name            = "activity_id"
  #    hash_key        = "activity_id"
  #    projection_type = "ALL"
  #  }
}

# unique key will be "activity_id#name_id"
resource "aws_dynamodb_table_item" "names_sample" {
  table_name = aws_dynamodb_table.names.name
  hash_key   = "activity_id" #must include sanitised name - e.g. aidan_oconnor
  range_key  = "name_id"

  item = jsonencode({
    #unique_id   = { S = "${local.activity_id}#aidan_oconnor" }
    activity_id = { S = local.activity_id }
    name_id     = { S = "aidan_oconnor" }
    display     = { S = "Aidan O'Connor" }
    filter      = { S = "u17" }
  })
}

# -------------------------------
# 📘 Table: Log
# -------------------------------
# Get all logs for "sorrento_youth_sunday" on "2025-08-12"
#aws dynamodb query \
# --table-name log \
# --key-condition-expression "activity_id = :aid and begins_with(log_id, :date)" \
# --expression-attribute-values '{
#   ":aid": {"S": "sorrento_youth_sunday"},
#   ":date": {"S": "2025-08-12"}
# }'
#
# Get all logs for "sorrento_youth_sunday" on "2025-08-12" and direction = "out"
#aws dynamodb query \
#  --table-name log \
#  --key-condition-expression "activity_id = :aid and begins_with(log_id, :date)" \
#  --filter-expression "direction = :dir" \
#  --expression-attribute-values '{
#    ":aid": {"S": "sorrento_youth_sunday"},
#    ":date": {"S": "2025-08-12"},
#    ":dir": {"S": "out"}
#  }'

# To maintain a composite key in Terraform 1.12, you must define 
# both attributes and assign the sort key implicitly by naming it 
# in the second attribute block
resource "aws_dynamodb_table" "log" {
  name         = "log"
  billing_mode = local.billing_mode
  hash_key     = "activity_id"
  range_key    = "log_id"

  # partition key - because it is listed 1st
  attribute {
    name = "activity_id"
    type = "S"
  }

  # sort/range key - beacuse it is listed 2nd
  attribute {
    name = "log_id"
    type = "S"
  }

  # NOTE: don't need to declare these for now, as not using a GSI or LSI yet :)
  #  attribute {
  #    name = "direction"
  #    type = "S"
  #  }
  #
  #  attribute {
  #    name = "name_id"
  #    type = "S"
  #  }
  #
  #  attribute {
  #    name = "date_time"
  #    type = "S"
  #  }
}

resource "aws_dynamodb_table_item" "log_sample" {
  table_name = aws_dynamodb_table.log.name
  hash_key   = "activity_id"
  range_key  = "log_id"

  item = jsonencode({
    activity_id = { S = local.activity_id }
    log_id      = { S = "2025-08-12T11:15:00Z#aidan_oconnor" }
    direction   = { S = "in" }
    name_id     = { S = "aidan_oconnor" }
    date_time   = { S = "2025-08-12T11:15:00Z" }
  })
}


# -------------------------------
# 📘 Table: Activity
# -------------------------------
resource "aws_dynamodb_table" "activity" {
  name         = "activity"
  billing_mode = local.billing_mode
  hash_key     = "name_id"

  attribute {
    name = "name_id"
    type = "S"
  }
}

resource "aws_dynamodb_table_item" "activity_sample" {
  table_name = aws_dynamodb_table.activity.name
  hash_key   = "name_id"

  item = jsonencode({
    name_id     = { S = local.activity_id }
    url_code    = { S = "YOUTH" }
    days_string = { S = "sunday" }
    in_h_start  = { N = "8" }
    in_m_start  = { N = "0" }
    in_h_end    = { N = "9" }
    in_m_end    = { N = "30" }
    out_h_start = { N = "9" }
    out_m_start = { N = "31" }
    out_h_end   = { N = "10" }
    out_m_end   = { N = "40" }
  })
}
