import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def log_event(event, context):
    logger.info("Event: %s", json.dumps(event))
    logger.info("Function: %s", context.function_name)
    logger.info("Request ID: %s", context.aws_request_id)