import subprocess
import json
import os
from collections import OrderedDict

ACTIVITY_ID = "sorrento_youth_sunday"
TABLE_NAME = "log"
BATCH_SIZE = 25
SCAN_FILE = "./current_logs.json"
BATCH_FILE = "./batch_log_delete.json"

def to_plain_dict(obj):
    """Recursively convert OrderedDicts to plain dicts."""
    if isinstance(obj, OrderedDict):
        return {k: to_plain_dict(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_plain_dict(item) for item in obj]
    else:
        return obj

def run_aws_cli(command):
    """Run an AWS CLI command and return parsed JSON output."""
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {result.stderr}")
    return json.loads(result.stdout)

def scan_table():
    """Scan the DynamoDB table for items matching a specific activity_id and save to file."""
    print(f"🔍 Scanning table: {TABLE_NAME} for activity_id = '{ACTIVITY_ID}'")

    expression_values = json.dumps({":aid": {"S": ACTIVITY_ID}}).replace('"', '\\"')

    command = (
        f"aws dynamodb scan "
        f"--table-name {TABLE_NAME} "
        f"--filter-expression \"activity_id = :aid\" "
        f"--expression-attribute-values \"{expression_values}\" "
        f"--output json"
    )

    data = run_aws_cli(command)
    items = data.get("Items", [])

    with open(SCAN_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"📁 Saved {len(items)} items to {SCAN_FILE}")
    return items

def build_batches(items):
    """Split items into batches of 25 for deletion."""
    batches = []
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i:i + BATCH_SIZE]
        delete_requests = []
        for item in batch:
            activity_id = item["activity_id"]
            log_id = item["log_id"]
            delete_requests.append({
                "DeleteRequest": {
                    "Key": {
                        "activity_id": activity_id,
                        "log_id": log_id
                    }
                }
            })
        batches.append({TABLE_NAME: delete_requests})  # ✅ No RequestItems wrapper
    return batches

def delete_batches(batches):
    """Send batch delete requests to DynamoDB using file input."""
    for idx, batch in enumerate(batches):
        print(f"🗑️ Deleting batch {idx + 1}/{len(batches)}...")

        with open(BATCH_FILE, "w", encoding="utf-8") as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)

        command = f"aws dynamodb batch-write-item --request-items file://{BATCH_FILE}"
        try:
            result = run_aws_cli(command)
            if result.get("UnprocessedItems"):
                print(f"⚠️ Batch {idx + 1} had unprocessed items: {result['UnprocessedItems']}")
                # Optional: retry logic could go here
        except RuntimeError as e:
            print(f"❌ Error deleting batch {idx + 1}: {e}")

    # Optional cleanup
    #if os.path.exists(BATCH_FILE):
    #    os.remove(BATCH_FILE)

def main():
    items = scan_table()
    if not items:
        print("No matching items found.")
        return

    items = [to_plain_dict(item) for item in items]
    batches = build_batches(items)
    delete_batches(batches)
    print("✅ Matching items deleted successfully.")

if __name__ == "__main__":
    main()


# Alternatively, if you want to simply delete the entire log table and re-create, use the following commands and schema file:
#
# >>>  aws dynamodb delete-table --table-name log
# >>>  aws dynamodb create-table --cli-input-json file://schema.json
#
# >>> more schema.json
# {
#   "AttributeDefinitions": [
#     {
#       "AttributeName": "activity_id",
#       "AttributeType": "S"
#     },
#     {
#       "AttributeName": "log_id",
#       "AttributeType": "S"
#     }
#   ],
#   "TableName": "log",
#   "KeySchema": [
#     {
#       "AttributeName": "activity_id",
#       "KeyType": "HASH"
#     },
#     {
#       "AttributeName": "log_id",
#       "KeyType": "RANGE"
#     }
#   ],
#   "BillingMode": "PAY_PER_REQUEST",
#   "DeletionProtectionEnabled": false
# }