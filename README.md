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

[./web/main/](./web/main/):
- [./web/main/config.json](./web/main/config.json) - set values used in html templates
- [./web/main/header.snippet](./web/main/header.snippet) - simple solution to enable different menu in demo/test site  
- [./web/main/history.template.html](./web/main/history.template.html) - inject-configs.js uses this to create history.html
- [./web/main/index.template.html](./web/main/index.template.html) - inject-configs.js uses this to create index.html
- [./web/main/live.template.html](./web/main/index.template.html) - inject-configs.js uses this to create live.html
- [./web/main/inject-config.js](./web/main/inject-config.js) - trigged by [./.github/workflows/upload-to-s3.yml](./.github/workflows/upload-to-s3.yml)

[./web/demo/](./web/demo/):
- Everything except [config.json](config.json) is a symbolic link back to [./web/main/](./web/main/)
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
- create new folder - e.g. `./web/reds`
- create ./web/reds/config.json
- create symbolic links for relevant files from ./reds/* to ../main/* 
- add `reds` to sync.sio.yml workflow
