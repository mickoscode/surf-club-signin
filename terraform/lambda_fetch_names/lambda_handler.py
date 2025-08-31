import json
import boto3
from boto3.dynamodb.conditions import Key


dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("names")

# filter  = { S = "u17" }
# if only activity_id is supplied, return a list of all names
# if both activity_id and name_id are supplied, return a single record (in theory)
def lambda_handler(event, context):
    try:
        # Parse query parameters
        params = event.get("queryStringParameters", {})
        activity_id = params.get("activity_id")
        name_id = params.get("name_id")

        if not activity_id:
            return build_response(400, {"message": "Missing activity_id"})

        # Query DynamoDB
        if (name_id):
            response = table.query(
                KeyConditionExpression=Key('activity_id').eq(activity_id) & Key('name_id').eq(name_id)
                #KeyConditionExpression="activity_id = :aid and name_id = :nid", ExpressionAttributeValues={":aid": activity_id, ":nid": name_id}
            )
        else:
            response = table.query(
                KeyConditionExpression=Key('activity_id').eq(activity_id)
                #KeyConditionExpression="activity_id = :aid", ExpressionAttributeValues={":aid": activity_id}
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