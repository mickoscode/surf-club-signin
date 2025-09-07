# sign-in-out.com go-live

The following tasks need to be completed before Youth can use sign-in-out.com:
- delete all test data in `log` table
- delete all test data in `names` table
- import names for 2025/26 season

## Deleting test data from DB table - brute force

If 100% sure all records can be deleted, could simply delete & re-create table.
This could be done via terraform, or via command line (so long as TF state drift is avoided)
e.g.
```
aws dynamodb describe-table --table-name log \
  | jq '.Table | del(.TableId, .TableArn, .ItemCount, .TableSizeBytes, .CreationDateTime, .TableStatus, .ProvisionedThroughput.NumberOfDecreasesToday)' \
  > schema.json

aws dynamodb delete-table --table-name log
aws dynamodb create-table --cli-input-json file://schema.json
```

Note: this didn't quite work on first attempt, becuase the schema file contained meta data which the `create-table` did not like. Once this meta data was removed, it worked. So the `describe-table` command is not quite write for this purpose!

## Deleting all data from `names` table, for specific records 

Use script [../scripts/delete_all_names.py](../scripts/delete_all_names.py)

## Importing data to `names` table, for specific `activity_id` 

Use script [../scripts/import_names_csv.py](../scripts/import_names_csv.py)
