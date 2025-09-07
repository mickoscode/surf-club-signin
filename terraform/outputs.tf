# Output the DNS validation records. 
output "acm_validation_record2" {
  value = {
    for dvo in aws_acm_certificate.domain2.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}

# Output CloudFront domain name, needed to create a CNAME DNS record
output "sio_cloudfront_domain_name" {
  value = aws_cloudfront_distribution.sio.domain_name
}

output "api_url" {
  value       = aws_apigatewayv2_api.api.api_endpoint
  description = "Base URL for the API Gateway"
}
