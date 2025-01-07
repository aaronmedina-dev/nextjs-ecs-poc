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
      image: ecs.ContainerImage.fromRegistry('<container-image-uri>'), // Replace with your container image URI
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