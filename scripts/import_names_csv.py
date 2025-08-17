import csv
import json
import re
import subprocess
import unicodedata
from typing import List

# Constants
ACTIVITY_ID = "sorrento_youth_sunday"
TABLE_NAME = "names"
CSV_FILE = "names.csv"
BATCH_SIZE = 25  # DynamoDB batch-write limit

# Converts display name to a lowercase, underscore-separated ID
def sanitize_name_id(display: str) -> str:
    # Normalize accented characters to ASCII equivalents
    normalized = unicodedata.normalize("NFKD", display)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    # Lowercase and remove unwanted characters (keep a-z, 0-9, and space)
    cleaned = re.sub(r"[^a-z0-9 ]+", "", ascii_only.lower()).strip(" ")
    # Replace spaces with underscores
    return re.sub(r"[ ]+", "_", cleaned)

# Constructs a single PutRequest item for DynamoDB batch-write-item
def build_put_request(display: str, filter_value: str) -> dict:
    name_id = sanitize_name_id(display)
    return {
        "PutRequest": {
            "Item": {
                "activity_id": { "S": ACTIVITY_ID },
                "name_id": { "S": name_id },
                "filter": { "S": filter_value },
                "display": { "S": display }
            }
        }
    }

# Reads CSV and returns list of PutRequest items
def read_csv(file_path: str) -> List[dict]:
    items = []
    #with open(file_path, newline="", encoding="utf-8") as csvfile:
    with open(file_path, encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            display = row.get("display", "").strip()
            filter_value = row.get("filter", "").strip()
            if display and filter_value:
                items.append(build_put_request(display, filter_value))
            else:
                print(f"⚠️  Skipping row with missing display or filter: {row}")
    return items

# Splits items into batches of specified size
def split_into_batches(items: List[dict], batch_size: int) -> List[List[dict]]:
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]

# Uploads a single batch to DynamoDB using AWS CLI
# Returns result dict with success/failure info
def upload_batch(batch: List[dict], batch_index: int) -> dict:
    payload = { TABLE_NAME: batch }
    try:
        result = subprocess.run(
            ["aws", "dynamodb", "batch-write-item", "--request-items", json.dumps(payload)],
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode != 0:
            print(f"❌ Batch {batch_index + 1} failed: {result.stderr.strip()}")
            return { "batch": batch_index + 1, "success": 0, "failed": len(batch) }

        response = json.loads(result.stdout)
        unprocessed = response.get("UnprocessedItems", {}).get(TABLE_NAME, [])
        success_count = len(batch) - len(unprocessed)
        print(f"✅ Batch {batch_index + 1}: {success_count}/{len(batch)} records uploaded")
        if unprocessed:
            print(f"⚠️  {len(unprocessed)} unprocessed items (likely duplicates or throttling)")
        return { "batch": batch_index + 1, "success": success_count, "failed": len(unprocessed) }

    except Exception as e:
        print(f"🔥 Exception in batch {batch_index + 1}: {e}")
        return { "batch": batch_index + 1, "success": 0, "failed": len(batch) }

def main():
    all_items = read_csv(CSV_FILE)
    batches = split_into_batches(all_items, BATCH_SIZE)
    total_success = 0
    total_failed = 0

    print(f"📦 Starting upload of {len(all_items)} records in {len(batches)} batches...\n")

    for i, batch in enumerate(batches):
        result = upload_batch(batch, i)
        total_success += result["success"]
        total_failed += result["failed"]

    print(f"\n🏁 Upload complete: {total_success} succeeded, {total_failed} failed.")

if __name__ == "__main__":
    main()