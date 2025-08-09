# -----------------------------------------------------------
# S3 Bucket Configuration - Step 2 of 2
# Create the S3 bucket to host your website content.
# -----------------------------------------------------------
resource "aws_s3_bucket" "website_bucket" {
  bucket = "micko-training2025.info"
}