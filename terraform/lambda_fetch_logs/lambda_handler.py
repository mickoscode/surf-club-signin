import json
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("log")

def lambda_handler(event, context):
    try:
        # Parse query parameters
        params = event.get("queryStringParameters", {})
        activity_id = params.get("activity_id")
        date_prefix = params.get("date")  # e.g., "2025-08-12"

        if not activity_id or not date_prefix:
            return build_response(400, {"message": "Missing activity_id or date."})

        # Query DynamoDB
        response = table.query(
            KeyConditionExpression="activity_id = :aid AND begins_with(log_id, :date)",
            ExpressionAttributeValues={
                ":aid": activity_id,
                ":date": date_prefix
            }
        )

        return build_response(200, {"logs": response.get("Items", [])})

    except Exception as e:
        return build_response(500, {"message": "Internal server error", "error": str(e)})

def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(body)
    }