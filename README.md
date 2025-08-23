# surf-club-signin
Simple website to enable paperless sign-in-out for surf club activities.

This website is hosted in aws s3, using API Gateway for serverless backend (lambda & dynamodb).

Currently (mvp release v0.1.0), much of the terraform and website config is hard coded.
The intention is to clean this up and enable others to re-use this repo.

See [requirements.md](./docs/requirements.md) and [release_plan.md](./docs/release_plan.md) for more context on how this website can be used.

## Project Context

The aims of this repo/project are:
1. Build a useful web app that will reduce paper waste when I facilitate surf club activities that require sign in/out.
1. Practice AI assisted coding - see [ai prompts](./.github/co-pilot/)

## Repo Overview

[./app/](./app/):
- [./app/config.json](./app/config.json) - set values used in html templates
- [./app/header.snippet](./app/header.snippet) - simple solution to enable different menu in demo/test site  
- [./app/history.template.html](./app/history.template.html) - inject-configs.js uses this to create history.html
- [./app/index.template.html](./app/index.template.html) - inject-configs.js uses this to create index.html
- [./app/live.template.html](./app/index.template.html) - inject-configs.js uses this to create live.html
- [./app/inject-config.js](./app/inject-config.js) - trigged by [./.github/workflows/upload-to-s3.yml](./.github/workflows/upload-to-s3.yml)

[./app-test/](./app-test/):
- Everything except [./app/config.json](./app/config.json) is a symbolic link back to [./app/](./app/)
- `"INJECT_ENABLE_TEST_MODE": "true"` in config.json is what enables all of the test/demo functionality 

[./scripts/](./scripts/):
- Python scripts to simplify basic web-dev site admin via AWS cli
- Plan is to build authentication and site driven admin, if more people want to create activities

[./terraform/](./terraform/):
- Basic code to build all of the aws resources (s3 bucket, api gateways, lambdas, dynamodb, certs, cloudfront & IAM policies)
- Targets a single environment and default VPC
- Not super re-usable in it's current state, but plan to clean this up in future releases

## Adding another club/group/activity - e.g. sorrento_redcaps_sunday
- Populate names table with list of allowed names for activity_id
- create new folder - e.g. `reds`
- create ./reds/config.json
- create symbolic links for relevant files from ./reds/* to ./app/* 
- add `reds` to upload-to-s3.yml workflow
