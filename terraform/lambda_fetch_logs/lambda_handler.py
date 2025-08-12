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
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Missing activity_id or date."})
            }

        # Query DynamoDB
        response = table.query(
            KeyConditionExpression="activity_id = :aid AND begins_with(log_id, :date)",
            ExpressionAttributeValues={
                ":aid": activity_id,
                ":date": date_prefix
            }
        )

        return {
            "statusCode": 200,
            "body": json.dumps({"logs": response.get("Items", [])})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Internal server error", "error": str(e)})
        }