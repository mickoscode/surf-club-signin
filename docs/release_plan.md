## MVP - release v0.1.0

- 1 use case (sorrento/youth/sunday), hard coded config as necessary
- users: ability to sign in & out via: index.html
- minimal/no admin via website (names table can be populated via python scripts)
- minimal/no authentication (allow anyone to view history)
- simple live report view (near real-time live head count to enable monitoring)
  - will need a filter to make list manageable (e.g. u14/u15/u17/u19)
- leaders: ability to view live head count via: live.html
- mirrored test/demo site to enable testing/demo outside activity windows

Public Functioning Pages:
- index.html  # form to sign in / out  - display info relative to recent/next session if outside window
- live.html   # live headcount, list of names & status
- report.html # list any csv reports, so user can click to view/download
- test/demo mirrors

## MVP - release v0.2.0
- Fix bugs!
- leaders: ability to bulk sign in & out via: leader.html

Public Functioning Pages:
- leader.html # form to do bulk sign in / out

## Release v0.3.0
- Fix bugs!
- All activity config (days & times) pulled from activity table (instead of hard coded)
- All html/java script cleaned up and modular
- Second club added (e.g. sorrento_redcaps_sunday, sorrento_youth_clubswim, etc.)

## Release v0.4.0
- Fix bugs!
- Improve TF/cloud front IAM to allow cache clearing and add to github workflow
- Enable github workflow to run on merge (instead of manually)
- All TF code cleaned up to be modular and multi-environment using tfvars

# Release v1.0.0
- Fix bugs!
- All test data purged, including unnecessary aws_dynamodb_table_item resources in dynamodb.tf
- Move aws_dynamodb_table_item resources in dynamodb to terraform_example.md in docs 
- Beta public release completed (min 4 real activites completed logged)
