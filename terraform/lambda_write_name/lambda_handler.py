import json, re, unicodedata
import boto3

def sanitize_name_id(display: str) -> str:
    normalized = unicodedata.normalize("NFKD", display)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-z0-9 ]+", "", ascii_only.lower()).strip(" ")
    return re.sub(r"[ ]+", "_", cleaned)

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")

    if method == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    body = json.loads(event["body"])
    display = body["display"]
    activity_id = body["activity_id"]
    filter_val = body["filter"]

    name_id = sanitize_name_id(display)

    dynamodb = boto3.client("dynamodb")
    dynamodb.put_item(
        TableName="names",
        Item={
            "name_id": {"S": name_id},
            "activity_id": {"S": activity_id},
            "filter": {"S": filter_val},
            "display": {"S": display}
        }
    )
    #return {"statusCode": 200, "body": json.dumps({"message": "Name added"})}
    return build_response(201, {"message": "Name added successfully."})


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