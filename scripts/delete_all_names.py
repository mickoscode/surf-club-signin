import subprocess
import json
import math

ACTIVITY_ID = "sorrento_youth_sunday"
TABLE_NAME = "names"
BATCH_SIZE = 25

def run_aws_cli(command):
    """Run an AWS CLI command and return parsed JSON output."""
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {result.stderr}")
    return json.loads(result.stdout)

def scan_table():
    """Scan the DynamoDB table for items matching a specific activity_id."""
    print(f"Scanning table: {TABLE_NAME} for activity_id = '{ACTIVITY_ID}'")
    
    # Escape double quotes inside JSON string for shell compatibility
    expression_values = json.dumps({":aid": {"S": ACTIVITY_ID}}).replace('"', '\\"')
    
    command = (
        f"aws dynamodb scan "
        f"--table-name {TABLE_NAME} "
        f"--filter-expression \"activity_id = :aid\" "
        f"--expression-attribute-values \"{expression_values}\" "
        f"--output json"
    )

    data = run_aws_cli(command)
    return data.get("Items", [])

def build_batches(items):
    """Split items into batches of 25 for deletion."""
    batches = []
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i:i + BATCH_SIZE]
        delete_requests = [
            {
                "DeleteRequest": {
                    "Key": {
                        "activity_id": item["activity_id"],
                        "name_id": item["name_id"]
                    }
                }
            }
            for item in batch
        ]
        batches.append({"RequestItems": {TABLE_NAME: delete_requests}})
    return batches

def delete_batches(batches):
    """Send batch delete requests to DynamoDB."""
    for idx, batch in enumerate(batches):
        print(f"Deleting batch {idx + 1}/{len(batches)}...")
        batch_json = json.dumps(batch)
        command = f"aws dynamodb batch-write-item --request-items '{batch_json}'"
        run_aws_cli(command)

def main():
    items = scan_table()
    if not items:
        print("No items found in table.")
        return

    batches = build_batches(items)
    delete_batches(batches)
    print("All items deleted successfully.")

if __name__ == "__main__":
    main()