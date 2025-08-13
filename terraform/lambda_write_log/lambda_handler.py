import json
import boto3
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("log")

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")

    if method == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    try:
        # Parse input from API Gateway
        body = json.loads(event.get("body", "{}"))
        activity_id = body.get("activity_id")
        name_id = body.get("name_id")
        direction = body.get("direction")
        date_time = body.get("date_time")  # Expected ISO format

        # Validate inputs
        if not all([activity_id, name_id, direction, date_time]):
            return build_response(400, {"message": "Missing required fields."})

        if direction not in ["in", "out"]:
            return build_response(400, {"message": "Invalid direction. Must be 'in' or 'out'."})

        # Validate date format
        try:
            dt_obj = datetime.fromisoformat(date_time.replace("Z", "+00:00"))
        except ValueError:
            return build_response(400, {"message": "Invalid date_time format. Use ISO 8601."})

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
        return build_response(201, {"message": "Log entry created successfully."})

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return build_response(409, {"message": "Duplicate log entry."})

    except Exception as e:
        return build_response(500, {"message": "Internal server error", "error": str(e)})

# Add cors headers to the response
def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(body)
    }