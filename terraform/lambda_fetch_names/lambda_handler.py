import json
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("names")

# unique key will be "activity_id#name_id"
# name_id = { S = "${local.activity_id}#joe_bloggs" }
# filter  = { S = "u17" }
def lambda_handler(event, context):
    try:
        # Parse query parameters
        params = event.get("queryStringParameters", {})
        activity_id = params.get("activity_id")

        if not activity_id:
            return build_response(400, {"message": "Missing activity_id"})

        # Query DynamoDB
        response = table.query(
            #IndexName="activity_id", #use the GSI
            KeyConditionExpression="activity_id = :aid",
            ExpressionAttributeValues={":aid": activity_id}
            #KeyConditionExpression="activity_id = :aid AND begins_with(unique_id, :uid)",
            #ExpressionAttributeValues={ ":aid": activity_id, ":uid": activity_id }
        )

        return build_response(200, {"names": response.get("Items", [])})

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