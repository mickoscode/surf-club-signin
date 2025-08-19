import json
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("log")

def lambda_handler(event, context):
    try:
        # Parse query parameters
        params = event.get("queryStringParameters", {})
        activity_id = params.get("activity_id")

        if not activity_id:
            return build_response(400, {"message": "Missing activity_id"})

        # Query all log_ids for the activity_id
        response = table.query(
            KeyConditionExpression="activity_id = :aid",
            ExpressionAttributeValues={":aid": activity_id},
            ProjectionExpression="log_id"
        )

        items = response.get("Items", [])
        unique_days = {item["log_id"][:10] for item in items if "log_id" in item}

        return build_response(200, {"dates": sorted(unique_days)})

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