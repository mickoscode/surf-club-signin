#!/bin/bash

# Schema:
# 

# Check if name_id is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <name_id> [--full]"
  exit 1
fi

# Assign the first argument to name_id
name_id="$1"

# Check for the optional --full flag
if [ "$2" == "--full" ]; then
  # Full verbose output
  aws dynamodb scan \
      --table-name log \
      --filter-expression "name_id = :nid" \
      --expression-attribute-values "{\":nid\": {\"S\": \"$name_id\"}}" \
      --output json
else
  # Default behavior with jq filter
  aws dynamodb scan \
      --table-name log \
      --filter-expression "name_id = :nid" \
      --expression-attribute-values "{\":nid\": {\"S\": \"$name_id\"}}" \
      --output json | jq -r ".Items[].date_time.S + \" \" + .Items[].direction.S" \
      | sed 's/T[^ ]*//' |sort |uniq
fi