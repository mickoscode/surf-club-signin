import json
import boto3
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("log")

def lambda_handler(event, context):
    try:
        # Parse input from API Gateway
        body = json.loads(event.get("body", "{}"))
        activity_id = body.get("activity_id")
        name_id = body.get("name_id")
        direction = body.get("direction")
        date_time = body.get("date_time")  # Expected ISO format

        # Validate inputs
        if not all([activity_id, name_id, direction, date_time]):
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Missing required fields."})
            }

        if direction not in ["in", "out"]:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Invalid direction. Must be 'in' or 'out'."})
            }

        # Validate date format
        try:
            dt_obj = datetime.fromisoformat(date_time.replace("Z", "+00:00"))
        except ValueError:
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Invalid date_time format. Use ISO 8601."})
            }

        # Construct log_id
        log_id = f"{date_time}#{name_id}"

        # Write to DynamoDB
        table.put_item(
            Item={
                "activity_id": activity_id,
                "log_id": log_id,
                "name_id": name_id,
                "direction": direction,
                "date_time": date_time
            },
            ConditionExpression="attribute_not_exists(log_id)"
        )

        return {
            "statusCode": 201,
            "body": json.dumps({"message": "Log entry created successfully."})
        }

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return {
            "statusCode": 409,
            "body": json.dumps({"message": "Duplicate log entry."})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Internal server error", "error": str(e)})
        }