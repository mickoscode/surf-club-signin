import json
import boto3
from logger import log_event

"""
If successful, this lamba wil return a json object like:

logs = [
  {
    date_time: { S: "2025-08-12T10:11:00Z" },
    log_id: { S: "2025-08-12T10:11:00Z#joe_bloggs" },
    name_id: { S: "joe_bloggs" },
    activity_id: { S: "sorrento_youth_sunday" },
    direction: { S: "in" }
  },
  {
    date_time: { S: "2025-08-12T10:11:00Z" },
    log_id: { S: "2025-08-12T10:11:00Z#jen_summers" },
    name_id: { S: "jen_summers" },
    activity_id: { S: "sorrento_youth_sunday" },
    direction: { S: "in" }
  }
]
"""

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("log")

def lambda_handler(event, context):
    log_event(event, context)
    try:
        # Parse query parameters
        params = event.get("queryStringParameters", {})
        activity_id = params.get("activity_id")
        name_id = params.get("name_id")

        if not activity_id or not name_id:
            return build_response(400, {"message": "Missing activity_id or name_id."})

        # Query DynamoDB
        response = table.query(
            KeyConditionExpression="activity_id = :aid AND name_id = :name",

            ExpressionAttributeValues={
                ":aid": activity_id,
                ":name": name_id
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