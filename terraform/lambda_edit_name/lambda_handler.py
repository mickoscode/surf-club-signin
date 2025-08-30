import json
import boto3

def lambda_handler(event, context):
    body = json.loads(event["body"])
    name_id = body["name_id"]
    activity_id = body["activity_id"]
    display = body["display"]
    filter_val = body["filter"]

    dynamodb = boto3.client("dynamodb")
    dynamodb.update_item(
        TableName="names",
        Key={
            "name_id": {"S": name_id},
            "activity_id": {"S": activity_id}
        },
        UpdateExpression="SET display = :d, filter = :f",
        ExpressionAttributeValues={
            ":d": {"S": display},
            ":f": {"S": filter_val}
        }
    )
    #return {"statusCode": 200, "body": json.dumps({"message": "Name updated"})}
    return build_response(201, {"message": "Name updated successfully."})

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