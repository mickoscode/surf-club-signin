import boto3
import json
import re
from datetime import datetime

# You can invoke this Lambda via API Gateway using:
# GET /log?name=Micko
#
# this lambda will need a role with permissions like:
#{
  #"Effect": "Allow",
  #"Action": [
    #"s3:GetObject",
    #"s3:PutObject"
  #],
  #"Resource": "arn:aws:s3:::micko-training2025.info/in.log"
#}

# Constants
BUCKET_NAME = "micko-training2025.info"
LOG_FILE_KEY = "in.log"

# S3 client
s3 = boto3.client("s3")

def validate_name(name: str) -> bool:
    # Allow only letters, numbers, underscores, hyphens, apostrophes and spaces
    return bool(re.fullmatch(r"[A-Za-z0-9_\-\' ]{1,100}", name))

def lambda_handler(event, context):
    # Extract 'name' from query string or JSON body
    name = event.get("queryStringParameters", {}).get("name") or \
           (json.loads(event.get("body", "{}")).get("name") if event.get("body") else None)

    if not name or not validate_name(name):
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Invalid 'name' parameter."})
        }

    try:
        # Try to read existing log file
        try:
            response = s3.get_object(Bucket=BUCKET_NAME, Key=LOG_FILE_KEY)
            log_data = response["Body"].read().decode("utf-8")
        except s3.exceptions.NoSuchKey:
            log_data = ""

        # Check for duplicate entry
        if name in log_data.splitlines():
            return {
                "statusCode": 409,
                "body": json.dumps({"message": f"Entry '{name}' already exists."})
            }

        # Append new entry with timestamp
        timestamp = datetime.utcnow().isoformat()
        new_entry = f"{name} - {timestamp}\n"
        updated_log = log_data + new_entry

        # Upload updated log
        s3.put_object(Bucket=BUCKET_NAME, Key=LOG_FILE_KEY, Body=updated_log.encode("utf-8"))

        return {
            "statusCode": 200,
            "body": json.dumps({"message": f"Entry '{name}' added successfully."})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Internal server error", "error": str(e)})
        }