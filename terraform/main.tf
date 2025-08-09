terraform {
  cloud {
    organization = "mickoscode"

    workspaces {
      name = "surf-club-signin"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.2.0"
}

# Configure the AWS Provider
provider "aws" {
  region = "ap-southeast-2"
}

# CloudFront requires the ACM certificate to be in the 'us-east-1' (N. Virginia) region.
# We must explicitly define a second provider block for this.
provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
}
