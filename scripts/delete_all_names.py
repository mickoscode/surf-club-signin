import subprocess
import json
import math
import os
from collections import OrderedDict

ACTIVITY_ID = "sorrento_youth_sunday"
TABLE_NAME = "names"
BATCH_SIZE = 25
SCAN_FILE = "./current_names.json"
BATCH_FILE = "./batch_delete.json"

# added this after a lot of failures related to OrderedDicts
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
    print(f"Scanning table: {TABLE_NAME} for activity_id = '{ACTIVITY_ID}'")
    
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
    
    with open(SCAN_FILE, "w") as f:
        json.dump(items, f, indent=2)
    
    print(f"Saved {len(items)} items to {SCAN_FILE}")
    return items

def build_batches(items):
    """Split items into batches of 25 for deletion."""
    batches = []
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i:i + BATCH_SIZE]
        delete_requests = []
        for item in batch:
            # Convert OrderedDict to plain dict
            activity_id = dict(item["activity_id"])
            name_id = dict(item["name_id"])
            delete_requests.append({
                "DeleteRequest": {
                    "Key": {
                        "activity_id": activity_id,
                        "name_id": name_id
                    }
                }
            })
        batches.append({"RequestItems": {TABLE_NAME: delete_requests}})
    return batches

def delete_batches(batches):
    """Send batch delete requests to DynamoDB using file input."""
    for idx, batch in enumerate(batches):
        print(f"Deleting batch {idx + 1}/{len(batches)}...")
        
        with open(BATCH_FILE, "w", encoding="utf-8") as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)
        
        command = f"aws dynamodb batch-write-item --request-items file://{BATCH_FILE}"
        run_aws_cli(command)

    # Clean up batch file
    #try running manually
    #aws dynamodb batch-write-item --request-items file://batch_delete.json
    #os.remove(BATCH_FILE)

def main():
    items = scan_table()
    if not items:
        print("No matching items found.")
        return

    # Convert all items to plain dicts

    # Recursively convert all items to plain dicts
    items = [to_plain_dict(item) for item in items]
    batch_clean = [json.loads(json.dumps(item)) for item in items]

    batches = build_batches(batch_clean)
    delete_batches(batches)
    print("Matching items deleted successfully.")

if __name__ == "__main__":
    main()