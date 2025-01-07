# Hosting a Next.js Application on AWS ECS with AWS CDK (TypeScript)

This guide walks you through creating a Proof of Concept (PoC) to host a Next.js application on AWS ECS Fargate using two separate repositories: one for infrastructure and another for the application code and container image. 

## **Architecture Overview**
1. **Two Repositories**:
   - **Infrastructure Repository**: Defines AWS infrastructure using AWS CDK (TypeScript).
   - **Application Repository**: Contains the Next.js app and Docker configuration.
2. **AWS ECS Fargate**: Runs containerized Next.js applications.
3. **AWS S3**: Contains assets and static files
3. **Best Practices**: Focus on scalability, security, and cost optimization.

---

## **Infrastructure Repository**

### **File Structure**
```
ecs-nextjs-infra/
├── bin/
│   └── ecs-nextjs-infra.ts        # CDK entry point
├── lib/
│   └── ecs-nextjs-infra-stack.ts  # Main stack definition
├── test/                          # Part of the initialisation but not used yet in this implementation
├── cdk.json                       # CDK configuration file
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript configuration
```

### **Steps**

#### **1. Initialize AWS CDK Project**
Run the following commands to set up the AWS CDK project:
```bash
mkdir ecs-nextjs-infra
cd ecs-nextjs-infra
cdk init app --language typescript
```

#### **2. Install Dependencies**
Add the necessary AWS CDK modules:
```bash
npm install @aws-cdk/aws-ecs @aws-cdk/aws-ecs-patterns @aws-cdk/aws-ec2 @aws-cdk/aws-iam @aws-cdk/aws-s3
```

#### **3. Define the CDK Stack**
File: `lib/ecs-nextjs-infra-stack.ts`
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class EcsNextjsInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for networking
    const vpc = new ec2.Vpc(this, 'NextJsVpc', {
      maxAzs: 2,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'EcsNextJsCluster', {
      vpc,
    });

    // S3 Bucket for static assets with public read access
    const assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      versioned: true,
      publicReadAccess: true, // Public access for static assets
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Optional: Auto-delete bucket on stack destroy
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    });

    // ECS Task Execution Role
    const executionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    executionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
    );

    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:GetAuthorizationToken',
          'ecr:BatchCheckLayerAvailability',
          'ecr:DescribeRepositories',
          'ecr:GetDownloadUrlForLayer',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          's3:GetObject',
          's3:ListBucket',
        ],
        resources: [assetsBucket.bucketArn, `${assetsBucket.bucketArn}/*`],
      })
    );

    // Fargate Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'EcsNextJsTaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: executionRole,
    });

    // Add container to task
    const container = taskDefinition.addContainer('EcsNextJsContainer', {
      image: ecs.ContainerImage.fromRegistry('<container-image-uri>'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'EcsNextJs' }),
    });

    container.addPortMappings({ containerPort: 3000 });

    // Fargate Service
    new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'EcsNextJsService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
    });
  }
}
```

#### **4. Deploy the Infrastructure**
Run the following commands to deploy the stack:
```bash
cdk bootstrap
cdk deploy
```

---

## **Application Repository**

### **File Structure**
```
ecs-nextjs-app/
├── public/                         # Static assets (to be manually uploaded to S3)
│   └── assets/
│   │     └── test-ecs.png
│   └── static/
│         └── data.json
├── src/
│   └── app/
│   │     └── api/
│   │     │     └── hello/
│   │     │           └── route.ts  # API sample
│   │     └── layout.tsx
│   │     └── page.tsx
│   └── styles/
│         └── globals.css
│         └── Home.module.css
├── Dockerfile                      # Container build instructions
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration (optional)
└── .dockerignore                   # Ignore files during Docker build
```

### **Steps**

#### **1. Create Next.js App**
Run the following command to scaffold a Next.js application:
```bash
npx create-next-app ecs-nextjs-app --use-npm
cd ecs-nextjs-app
```

#### **2. Set Node.js Version**
Specify Node.js v18 by creating an `.nvmrc` file:
```
18
```

#### **3. Write Dockerfile**
File: `Dockerfile`
```dockerfile
# Use Node.js v18 (LTS version)
FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the application excluding the public folder since contents will be moved to S3
COPY . .
RUN rm -rf public

# Build the application
RUN npm run build

# Expose the app on port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

#### **4. Upload Static Assets to S3**
Use the AWS CLI to upload the `public` folder contents to the S3 bucket:
```bash
aws s3 sync public/assets/ s3://<bucket-name>/assets/
aws s3 sync public/static/ s3://<bucket-name>/static/
```

#### **5. Update Application Code **

page.tsx
```typescript
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from '../styles/Home.module.css';

const Home: React.FC = () => {
    const [apiParam, setApiParam] = useState('');
    const [staticData, setStaticData] = useState<{ title: string; description: string } | null>(null);
    const router = useRouter();

    const handleRedirect = () => {
        if (apiParam.trim()) {
            router.push(`/api/hello?name=${encodeURIComponent(apiParam)}`);
        }
    };

    const bucketUrl = 'https://ecsnextjsinfrastack-assetsbucket5cb76180-dx3lkjozgh26.s3.<region>.amazonaws.com';

    useEffect(() => {
      fetch(`${bucketUrl}/static/data.json`)
          .then((response) => {
              if (!response.ok) {
                  throw new Error(`HTTP error! Status: ${response.status}`);
              }
              return response.json();
          })
          .then((data) => setStaticData(data))
          .catch((error) => console.error('Error fetching static data:', error));
    }, []);
  

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>{staticData?.title || 'Loading....'}</h1>
                <p>{staticData?.description || 'Fetching static data....'}</p>
                <br />
                <p>Title and Description loaded from <a href={`${bucketUrl}/static/data.json`}>data.json in S3</a></p>
            </header>

            <main className={styles.main}>
                <section className={styles.imageComparison}>
                    <h2>Image Optimisation Example</h2>
                    <p>
                        Below is an example of Next.js image optimisation: the same image
                        rendered at <strong>different quality levels</strong>.
                    </p>
                    <div className={styles.imageContainer}>
                        <div>
                            <Image
                                src={`${bucketUrl}/assets/test-ecs.png`}
                                alt="Optimised Image (Quality: 1)"
                                width={500}
                                quality={1}
                                className={styles.image}
                            />
                            <p>Width:500 Quality: 1</p>
                        </div>
                        <div>
                            <Image
                                src={`${bucketUrl}/assets/test-ecs.png`}
                                alt="Optimised Image (Quality: 100)"
                                width={500}
                                quality={100}
                                className={styles.image}
                            />
                            <p>Width:500 Quality: 100</p>
                        </div>
                    </div>
                </section>

                <section className={styles.links}>
                    <h2>Explore More</h2>
                    <p>
                        <label htmlFor="apiParam" className={styles.label}>
                            API Demo. Enter a parameter to test API route:
                        </label>
                        <input
                            type="text"
                            id="apiParam"
                            className={styles.input}
                            value={apiParam}
                            onChange={(e) => setApiParam(e.target.value)}
                            placeholder="Enter Name"
                        />
                        <button
                            className={styles.button}
                            onClick={handleRedirect}
                            disabled={!apiParam.trim()}
                        >
                            Go to API Page
                        </button>
                    </p>
                </section>
            </main>

            <footer className={styles.footer}>
                <p>Built with ❤️ using Next.js, TypeScript, and AWS.</p>
            </footer>
        </div>
    );
};

export default Home;
```

layout.tsx
```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextJS on ECS",
  description: "Proof of concept for deploying NextJS on ECS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
```

Update `next.config.ts` for adding external image resources
```typescript
import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '<bucket-name>.s3.<region>.amazonaws.com',
        pathname: '/assets/images/**',
      },
    ],
  },
};

export default nextConfig;
```


copy the `styles` folder and contents inside `src` folder

#### **6. Build and Push Docker Image**
Build and push the container image to the ECR repository:
```bash
# Authenticate with ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Build and tag the image
docker build -t ecs-nextjs-app:latest .
docker tag ecs-nextjs-app:latest <account-id>.dkr.ecr.<region>.amazonaws.com/ecs-nextjs-app:latest

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ecs-nextjs-app:latest
```

---

## **Deployment Order and Updates**

### **Initial Deployment**
1. **Manually Create the ECR Repository**:
   ```bash
   aws ecr create-repository --repository-name ecs-nextjs-app
   ```

2. Deploy the **infrastructure repository**:
   ```bash
   cdk deploy
   ```

3. Upload static assets to S3:
   ```bash
   aws s3 sync public/assets/ s3://<bucket-name>/assets/
   aws s3 sync public/static/ s3://<bucket-name>/static/
   ```

4. Build and push the Docker image from the **application repository**:
   ```bash
   docker build -t ecs-nextjs-app .
   docker tag ecs-nextjs-app:latest <account-id>.dkr.ecr.<region>.amazonaws.com/ecs-nextjs-app:latest
   docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ecs-nextjs-app:latest
   ```

5. Update ECS service to pull the latest image:
   ```bash
   aws ecs update-service --cluster <cluster-name> --service <service-name> --force-new-deployment
   ```

### **Updating the Application**
- **App-only Changes**: Build and push the updated Docker image, then update the ECS service.
- **Infrastructure Changes**: Update the CDK stack and redeploy with `cdk deploy`.

---

## **Testing the Application**

After deploying the infrastructure and updating the ECS service, test the application to ensure it’s running correctly.

### **Steps to Test the Application**

#### **1. Retrieve the Application URL**
- Once the `cdk deploy` command completes, look for the Application Load Balancer (ALB) DNS name in the output.
- The ALB DNS name will look something like this:
  ```
  EcsNextJsServiceLoadBalancer-1234567890.<region>.elb.amazonaws.com
  ```

#### **2. Access the Application**
- Open your browser and navigate to:
  ```
  http://<ALB-DNS-Name>
  ```
  Replace `<ALB-DNS-Name>` with the actual DNS name of the load balancer.

#### **3. Verify Application Functionality**
- You should see your Next.js application’s homepage.
- Verify any additional functionality, such as navigation or API endpoints.

#### **4. Check Logs**
- If the application isn’t working as expected, check the logs in CloudWatch:
  ```bash
  aws logs describe-log-groups
  aws logs get-log-events --log-group-name /aws/ecs/EcsNextJsService --log-stream-name <log-stream-name>
  ```

#### **5. Test Using `curl` (Optional)**
- Use `curl` to test the application endpoint:
  ```bash
  curl http://<ALB-DNS-Name>
  ```
  Replace `<ALB-DNS-Name>` with your ALB DNS name.
  
  ---

## **Troubleshooting ECS Deployment Issues**

### **Problem: CannotPullContainerError**

#### **1. ECR Repository Missing or Misconfigured**
   - **Cause**: The ECR repository might not exist or the image was not pushed to the correct repository.
   - **Fix**: Ensure that:
     1. The ECR repository was created **before** deploying the application.
     2. The image is pushed to the correct ECR repository and tagged correctly.

     Verify the repository and the image:
     ```bash
     aws ecr describe-repositories
     aws ecr list-images --repository-name ecs-nextjs-app
     ```

     If the repository doesn’t exist:
     - Create it manually:
       ```bash
       aws ecr create-repository --repository-name ecs-nextjs-app
       ```
     - Push the Docker image again.

#### **2. Incorrect Image Reference**
   - **Cause**: The task definition is referring to an incorrect or outdated image tag.
   - **Fix**: Confirm the image URI in the ECS task definition matches the image you pushed to ECR.

     Example image URI:
     ```
     <account-id>.dkr.ecr.<region>.amazonaws.com/ecs-nextjs-app:latest
     ```

     Update the task definition if needed:
     ```bash
     aws ecs register-task-definition --cli-input-json file://task-definition.json
     ```

#### **3. ECS Task Role Lacking Permissions**
   - **Cause**: The ECS task execution role doesn’t have sufficient permissions to pull images from ECR.
   - **Fix**: Ensure the task execution role has the following policy:
     ```json
     {
       "Effect": "Allow",
       "Action": [
         "ecr:GetAuthorizationToken",
         "ecr:BatchCheckLayerAvailability",
         "ecr:GetDownloadUrlForLayer",
         "ecr:DescribeRepositories"
       ],
       "Resource": "*"
     }
     ```

     Attach this policy to the ECS task execution role:
     ```bash
     aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
     ```

#### **4. AWS Region Mismatch**
   - **Cause**: The ECR repository and ECS cluster might be in different regions.
   - **Fix**: Confirm that both the ECS cluster and ECR repository are in the same region.

     Check the regions:
     ```bash
     aws ecs describe-clusters --cluster <cluster-name>
     aws ecr describe-repositories
     ```

     If regions don’t match, ensure your deployment scripts and configurations target the same region.

#### **5. Docker Image Not Built or Pushed Correctly**
   - **Cause**: The Docker image might not have been built or pushed correctly.
   - **Fix**:
     1. Authenticate Docker to ECR:
        ```bash
        aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
        ```
     2. Build and push the image:
        ```bash
        docker build -t ecs-nextjs-app:latest .
        docker tag ecs-nextjs-app:latest <account-id>.dkr.ecr.<region>.amazonaws.com/ecs-nextjs-app:latest
        docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ecs-nextjs-app:latest
        ```

#### **6. Network Issues**
   - **Cause**: ECS tasks in private subnets may lack internet access to pull images.
   - **Fix**: Ensure the ECS tasks have access to the internet by attaching a NAT Gateway to the VPC or by configuring the ECS task to use a public subnet.

---
