import argparse
import csv
import json
import os
import re
import subprocess
import sys
import unicodedata
from typing import List

# Constants
VALID_ACTIVITY_IDS = [
    "sorrento_pink_sunday", 
    "sorrento_white_sunday", 
    "sorrento_yellow_sunday", 
    "sorrento_green_sunday", 
    "sorrento_lblue_sunday", 
    "sorrento_purple_sunday",
    "sorrento_dblue_sunday", 
    "sorrento_red_sunday", 
    "sorrento_youth_sunday", 
    "demo"
]
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
def build_put_request(display: str, filter_value: str, activity_id: str) -> dict:
    name_id = sanitize_name_id(display)
    return {
        "PutRequest": {
            "Item": {
                "activity_id": { "S": activity_id },
                "name_id": { "S": name_id },
                "filter": { "S": filter_value },
                "display": { "S": display }
            }
        }
    }

# Reads CSV and returns list of PutRequest items
# The CSV file is expected to have 'display' and 'filter' columns (i.e. first line headers)
def read_csv(file_path: str, activity_id: str) -> List[dict]:
    items = []
    #with open(file_path, newline="", encoding="utf-8") as csvfile:
    with open(file_path, encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            display = row.get("display", "").strip()
            filter_value = row.get("filter", "").strip()
            if display and filter_value:
                items.append(build_put_request(display, filter_value, activity_id))
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

def parse_arguments():
    parser = argparse.ArgumentParser(description=f"Import names from {CSV_FILE} to DynamoDB")
    parser.add_argument(
        "activity_id",
        help=f"Activity ID (must be one of: {', '.join(VALID_ACTIVITY_IDS)})"
    )
    
    args = parser.parse_args()
    
    # Validate activity_id
    if args.activity_id not in VALID_ACTIVITY_IDS:
        print(f"❌ Error: Invalid activity_id '{args.activity_id}'")
        print(f"Valid options are: {', '.join(VALID_ACTIVITY_IDS)}")
        sys.exit(1)
    
    return args.activity_id

def validate_csv_file():
    """Check if the CSV file exists and is readable"""
    if not os.path.exists(CSV_FILE):
        print(f"❌ Error: CSV file '{CSV_FILE}' not found")
        print(f"Please ensure '{CSV_FILE}' exists in the current directory")
        sys.exit(1)
    
    if not os.path.isfile(CSV_FILE):
        print(f"❌ Error: '{CSV_FILE}' exists but is not a file")
        sys.exit(1)
    
    if not os.access(CSV_FILE, os.R_OK):
        print(f"❌ Error: '{CSV_FILE}' exists but is not readable")
        print("Please check file permissions")
        sys.exit(1)

def main():
    activity_id = parse_arguments()
    validate_csv_file()
    
    all_items = read_csv(CSV_FILE, activity_id)
    batches = split_into_batches(all_items, BATCH_SIZE)
    total_success = 0
    total_failed = 0

    print(f"📦 Starting upload of {len(all_items)} records in {len(batches)} batches for activity '{activity_id}'...\n")

    for i, batch in enumerate(batches):
        result = upload_batch(batch, i)
        total_success += result["success"]
        total_failed += result["failed"]

    print(f"\n🏁 Upload complete: {total_success} succeeded, {total_failed} failed.")

if __name__ == "__main__":
    main()