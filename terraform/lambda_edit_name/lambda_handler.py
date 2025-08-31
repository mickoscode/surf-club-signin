import json
import boto3
from logger import log_event
import traceback

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    log_event(event, context)

    if method == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    try:
        # parse inputs
        body = json.loads(event["body"])
        name_id = body["name_id"]
        activity_id = body["activity_id"]
        display = body["display"]
        filter = body["filter"]
    
        # Validate inputs
        if not all([activity_id, name_id, display, filter]):
            return build_response(400, {"message": "Missing required fields."})

        print("Attempting update for:", name_id, activity_id)
        dynamodb = boto3.client("dynamodb")
        dynamodb.update_item(
            TableName="names",
            Key={
                "name_id": {"S": name_id},
                "activity_id": {"S": activity_id}
            },
            UpdateExpression="SET display = :d, filter = :f",
            ExpressionAttributeValues={ ":d": {"S": display}, ":f": {"S": filter} },
            ConditionExpression="attribute_exists(name_id) AND attribute_exists(activity_id)"
        )
        #return {"statusCode": 200, "body": json.dumps({"message": "Name updated"})}
        return build_response(201, {"message": "Name updated successfully."})

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        print("Conditional check failed for:", name_id, activity_id)
        return build_response(409, {"message": "Could not match an existing entry for updating"})

    except Exception as e:
        print("500 Error for:", name_id, activity_id, str(e))
        print("Unhandled exception:", traceback.format_exc())
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