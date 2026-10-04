import json
import logging
import boto3
from datetime import datetime
from logger import log_event

logger = logging.getLogger()

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("log")

def lambda_handler(event, context):
    log_event(event, context)
    method = event.get("requestContext", {}).get("http", {}).get("method", "")

    if method == "OPTIONS":
        return build_response(200, {"message": "CORS preflight OK"})

    written = 0
    skipped = []

    try:
        # Parse input from API Gateway
        body = json.loads(event.get("body", "{}"))
        activity_id = body.get("activity_id")
        direction = body.get("direction")
        name_id_list = body.get("name_id_list")
        date_time = body.get("date_time")  # Expected ISO format

        # Validate inputs
        if not all([activity_id, direction, name_id_list, date_time]):
            return build_response(400, {"message": "Missing required fields."})

        if direction not in ["in", "out"]:
            return build_response(400, {"message": "Invalid direction. Must be 'in' or 'out'."})

        if not isinstance(name_id_list, list):
            return build_response(400, {"message": "name_id_list must be a list."})

        # Validate date format
        try:
            dt_obj = datetime.fromisoformat(date_time.replace("Z", "+00:00"))
        except ValueError:
            return build_response(400, {"message": "Invalid date_time format. Use ISO 8601."})

        for name_id in name_id_list:
            if not name_id:
                continue
            # Construct log_id
            log_id = f"{date_time}#{name_id}"

            # Write to DynamoDB. A name already recorded for this timestamp is skipped (not an
            # error), so a retry of a partly-failed submission with the same date_time is safe.
            try:
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
                written += 1
            except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
                skipped.append(name_id)

        return build_response(201, {
            "message": "Bulk log entries created successfully.",
            "written": written,
            "skipped": skipped
        })

    except Exception:
        # Log the details; don't return exception text to the browser
        logger.exception("Bulk write failed after %d written", written)
        return build_response(500, {
            "message": "Internal server error. Some entries may have been written; retry to complete.",
            "written": written
        })

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
