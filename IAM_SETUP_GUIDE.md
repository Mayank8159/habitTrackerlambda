# AWS IAM Permissions - Deployment Fix Guide

## Issue
The IAM user `mayank` lacks required permissions to deploy the habit tracker backend. Specifically, it's missing:
- `cloudformation:DescribeStacks`
- And other related CloudFormation, Lambda, and DynamoDB permissions

## Solution: Update IAM User Permissions

### Option A: Using AWS Console (Recommended for Quick Fix)

#### Step 1: Go to IAM Console
1. Navigate to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Go to **Users** in the left sidebar
3. Click on user **mayank**

#### Step 2: Add Inline Policy
1. Click on the **Permissions** tab
2. Click **Add inline policy** button
3. Choose **JSON** tab
4. Copy the entire content from `IAM_POLICY.json` file
5. Paste it into the JSON editor
6. Click **Review policy**
7. Name it: `ServerlessDeploymentPolicy`
8. Click **Create policy**

#### Step 3: Verify
1. Go back to user **mayank**
2. Verify the new policy appears in **Inline policies** section
3. Click on the policy to view details

---

### Option B: Using AWS CLI

If you have AWS CLI configured:

```bash
# Run from the habitTrackerbackend directory
aws iam put-user-policy --user-name mayank --policy-name ServerlessDeploymentPolicy --policy-document file://IAM_POLICY.json
```

**Verify**:
```bash
aws iam get-user-policy --user-name mayank --policy-name ServerlessDeploymentPolicy
```

---

### Option C: Using AWS CloudFormation or Terraform

Create a separate stack to manage IAM permissions (advanced).

---

## What Permissions Are Being Granted

The `IAM_POLICY.json` includes permissions for:

### 1. CloudFormation (Required for Serverless Framework)
- Create/Update/Delete stacks
- Describe stacks and resources
- Validate templates

### 2. Lambda (Core Compute)
- Create/Update/Delete functions
- Manage function code and configuration
- List functions and get details

### 3. API Gateway (HTTP API)
- Create/Update/Delete APIs
- Manage resources and methods
- Configure CORS and integrations

### 4. DynamoDB (Database)
- Create/Update/Delete tables
- Manage GSI (Global Secondary Indexes)
- Configure billing mode and TTL

### 5. IAM Roles (Security)
- Create/update roles
- Attach policies to roles
- Pass roles to Lambda (critical for least-privilege access)

### 6. S3 (Artifact Storage)
- Upload/Download deployment packages
- Serverless Framework stores artifacts in S3

### 7. CloudWatch Logs (Monitoring)
- Create log groups
- View and filter logs
- Set retention policies

### 8. CloudWatch Metrics (Monitoring)
- Create alarms
- Publish metrics

---

## Detailed Steps for AWS Console

### Step-by-Step with Screenshots Guide

1. **Open AWS IAM Console**
   - URL: https://console.aws.amazon.com/iam/
   - Log in with your AWS account root credentials or admin user

2. **Navigate to Users**
   - Left sidebar → **Users**
   - Click on **mayank** user

3. **Go to Permissions Tab**
   - Click the **Permissions** tab
   - You'll see existing policies (if any)

4. **Create Inline Policy**
   - Click **Add inline policy** (or "Add permissions" → "Add inline policy")
   - Choose the **JSON** tab

5. **Paste the Policy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "CloudFormationAccess",
         "Effect": "Allow",
         "Action": [
           "cloudformation:CreateStack",
           "cloudformation:UpdateStack",
           "cloudformation:DeleteStack",
           "cloudformation:DescribeStacks",
           "cloudformation:DescribeStackResource",
           "cloudformation:DescribeStackResources",
           "cloudformation:DescribeStackEvents",
           "cloudformation:ListStackResources",
           "cloudformation:GetTemplate",
           "cloudformation:ValidateTemplate"
         ],
         "Resource": "*"
       },
       {
         "Sid": "LambdaAccess",
         "Effect": "Allow",
         "Action": [
           "lambda:*"
         ],
         "Resource": "*"
       },
       {
         "Sid": "APIGatewayAccess",
         "Effect": "Allow",
         "Action": [
           "apigateway:*"
         ],
         "Resource": "*"
       },
       {
         "Sid": "DynamoDBAccess",
         "Effect": "Allow",
         "Action": [
           "dynamodb:*"
         ],
         "Resource": "*"
       },
       {
         "Sid": "IAMRoleAccess",
         "Effect": "Allow",
         "Action": [
           "iam:GetRole",
           "iam:CreateRole",
           "iam:PutRolePolicy",
           "iam:PassRole",
           "iam:DeleteRole",
           "iam:DeleteRolePolicy",
           "iam:AttachRolePolicy",
           "iam:DetachRolePolicy"
         ],
         "Resource": "*"
       },
       {
         "Sid": "S3Access",
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:CreateBucket",
           "s3:DeleteBucket",
           "s3:ListBucket"
         ],
         "Resource": "*"
       },
       {
         "Sid": "CloudWatchLogsAccess",
         "Effect": "Allow",
         "Action": [
           "logs:CreateLogGroup",
           "logs:DeleteLogGroup",
           "logs:DescribeLogGroups",
           "logs:FilterLogEvents",
           "logs:GetLogEvents",
           "logs:PutRetentionPolicy"
         ],
         "Resource": "*"
       },
       {
         "Sid": "CloudWatchMetricsAccess",
         "Effect": "Allow",
         "Action": [
           "cloudwatch:PutMetricAlarm",
           "cloudwatch:DeleteAlarms",
           "cloudwatch:DescribeAlarms"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

6. **Review and Create**
   - Click **Review policy**
   - Name: `ServerlessDeploymentPolicy`
   - Click **Create policy**

7. **Verify**
   - Return to user **mayank**
   - Confirm new policy appears in **Inline policies** section

---

## Testing the Fix

After applying the policy:

1. **Wait 1-2 minutes** for AWS to propagate the changes

2. **Test locally first**:
   ```bash
   npm run deploy
   ```

3. **If successful, rerun GitHub Actions**:
   - Go to your GitHub repository
   - Navigate to **Actions** tab
   - Find the failed workflow
   - Click **Re-run failed jobs** or **Re-run all jobs**

4. **Monitor the deployment**:
   - Watch the workflow execute
   - Check logs for any errors

---

## Troubleshooting

### Still Getting Permission Errors?

1. **Check policy was applied**:
   ```bash
   aws iam get-user-policy --user-name mayank --policy-name ServerlessDeploymentPolicy
   ```

2. **List all user policies**:
   ```bash
   aws iam list-user-policies --user-name mayank
   ```

3. **Check attached policies**:
   ```bash
   aws iam list-attached-user-policies --user-name mayank
   ```

### Policy Not Taking Effect?

- AWS takes 1-5 minutes to propagate policy changes
- Clear your AWS CLI cache: `rm -rf ~/.aws/cli/cache`
- Re-authenticate with `aws configure`
- Generate new access keys if needed

### Different Error?

1. Note the exact error and action (e.g., `dynamodb:CreateTable`)
2. Add that action to the appropriate `Sid` in the policy
3. Reapply the policy
4. Retry deployment

---

## Security Notes

⚠️ **Current Policy** uses wildcard (`*`) for most resources, which is permissive for development.

**For Production**, consider more restrictive policies:

```json
{
  "Sid": "CloudFormationStackOnly",
  "Effect": "Allow",
  "Action": "cloudformation:*",
  "Resource": "arn:aws:cloudformation:ap-south-1:518824469533:stack/habit-tracker-backend-*/*"
}
```

Replace `ap-south-1` with your region and `518824469533` with your account ID.

---

## Quick Checklist

- [ ] Opened AWS IAM Console
- [ ] Found user **mayank**
- [ ] Navigated to Permissions tab
- [ ] Created inline policy
- [ ] Pasted full JSON from `IAM_POLICY.json`
- [ ] Named policy `ServerlessDeploymentPolicy`
- [ ] Clicked Create policy
- [ ] Verified policy appears under Inline policies
- [ ] Waited 1-2 minutes for propagation
- [ ] Reran GitHub Actions workflow
- [ ] Deployment successful ✅

---

## Resources

- [AWS IAM Console](https://console.aws.amazon.com/iam/)
- [AWS CloudFormation Permissions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-template.html)
- [Serverless Framework IAM Permissions](https://www.serverless.com/framework/docs/providers/aws/guide/credentials/)
- [AWS Policy Simulator](https://policysim.aws.amazon.com/)

---

**Next Step**: Apply the policy using Option A, B, or C above, then rerun the GitHub Actions workflow.
