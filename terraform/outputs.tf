# Output the DNS validation records. 
output "acm_validation_record" {
  value = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}
# Output the DNS validation records for 2nd cert
output "acm_validation_record2" {
  value = {
    for dvo in aws_acm_certificate.domain2.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}

# An output value to get the CloudFront domain name, which you will use
# to create a CNAME record in your DNS.
output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

output "sio_cloudfront_domain_name" {
  value = aws_cloudfront_distribution.sio.domain_name
}

output "api_url" {
  value       = aws_apigatewayv2_api.api.api_endpoint
  description = "Base URL for the API Gateway"
}

