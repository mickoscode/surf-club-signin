terraform { 
  cloud { 
    
    organization = "mickoscode" 

    workspaces { 
      name = "mc-dev-cli" 
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
