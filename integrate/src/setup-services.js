import { CreateBucketCommand, PutBucketNotificationConfigurationCommand, S3Client } from '@aws-sdk/client-s3';
import { CreateDBInstanceCommand, DescribeDBInstancesCommand, RDSClient } from '@aws-sdk/client-rds';
import { CreateFunctionCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { CreateQueueCommand, GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import { CreateStateMachineCommand, SFNClient } from '@aws-sdk/client-sfn';
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTopicCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';

import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Script para configurar todos los servicios AWS necesarios
 */
class AWSServicesSetup {
    constructor() {
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.s3Client = new S3Client({ region: this.region });
        this.sqsClient = new SQSClient({ region: this.region });
        this.snsClient = new SNSClient({ region: this.region });
        this.dynamoClient = new DynamoDBClient({ region: this.region });
        this.rdsClient = new RDSClient({ region: this.region });
        this.sfnClient = new SFNClient({ region: this.region });
        this.lambdaClient = new LambdaClient({ region: this.region });
    }

    /**
     * Configurar todos los servicios
     */
    async setupAllServices() {
        console.log('🚀 Configurando servicios AWS...\n');

        const services = [
            { name: 'S3 Bucket', fn: () => this.setupS3() },
            { name: 'DynamoDB Table', fn: () => this.setupDynamoDB() },
            { name: 'SQS Queue', fn: () => this.setupSQS() },
            { name: 'SNS Topic', fn: () => this.setupSNS() },
            { name: 'RDS Instance', fn: () => this.setupRDS() },
            { name: 'Lambda Functions', fn: () => this.setupLambda() },
            { name: 'Step Functions', fn: () => this.setupStepFunctions() }
        ];

        const results = [];

        for (const service of services) {
            try {
                console.log(`🔧 Configurando ${service.name}...`);
                const result = await service.fn();
                results.push({ service: service.name, success: true, result });
                console.log(`✅ ${service.name} configurado exitosamente\n`);
            } catch (error) {
                results.push({ service: service.name, success: false, error: error.message });
                console.log(`❌ Error configurando ${service.name}: ${error.message}\n`);
            }
        }

        this.printSetupResults(results);
        return results;
    }

    /**
     * Configurar S3 Bucket
     */
    async setupS3() {
        const bucketName = process.env.S3_BUCKET_NAME || 'aws-integration-bucket';

        try {
            // Verificar si el bucket ya existe
            try {
                await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
                console.log(`   📦 Bucket ${bucketName} creado`);
            } catch (error) {
                if (error.name === 'BucketAlreadyOwnedByYou') {
                    console.log(`   📦 Bucket ${bucketName} ya existe`);
                } else {
                    throw error;
                }
            }

            return {
                bucketName: bucketName,
                region: this.region
            };
        } catch (error) {
            throw new Error(`Error configurando S3: ${error.message}`);
        }
    }

    /**
     * Configurar DynamoDB Table
     */
    async setupDynamoDB() {
        const tableName = process.env.DYNAMODB_TABLE_NAME || 'integration-table';

        try {
            // Verificar si la tabla ya existe
            try {
                await this.dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
                console.log(`   🗄️ Tabla ${tableName} ya existe`);
                return { tableName, exists: true };
            } catch (error) {
                if (error.name !== 'ResourceNotFoundException') {
                    throw error;
                }
            }

            // Crear la tabla
            const createTableParams = {
                TableName: tableName,
                KeySchema: [
                    {
                        AttributeName: 'id',
                        KeyType: 'HASH'
                    }
                ],
                AttributeDefinitions: [
                    {
                        AttributeName: 'id',
                        AttributeType: 'S'
                    }
                ],
                BillingMode: 'PAY_PER_REQUEST'
            };

            await this.dynamoClient.send(new CreateTableCommand(createTableParams));
            console.log(`   🗄️ Tabla ${tableName} creada`);

            return { tableName, exists: false };
        } catch (error) {
            throw new Error(`Error configurando DynamoDB: ${error.message}`);
        }
    }

    /**
     * Configurar SQS Queue
     */
    async setupSQS() {
        const queueName = 'integration-queue';

        try {
            const createQueueParams = {
                QueueName: queueName,
                Attributes: {
                    VisibilityTimeoutSeconds: '300',
                    MessageRetentionPeriod: '1209600',
                    ReceiveMessageWaitTimeSeconds: '20'
                }
            };

            const result = await this.sqsClient.send(new CreateQueueCommand(createQueueParams));
            console.log(`   📨 Cola ${queueName} creada`);

            // Obtener URL de la cola
            const queueAttributes = await this.sqsClient.send(new GetQueueAttributesCommand({
                QueueUrl: result.QueueUrl,
                AttributeNames: ['QueueUrl']
            }));

            return {
                queueName,
                queueUrl: result.QueueUrl
            };
        } catch (error) {
            if (error.name === 'QueueAlreadyExists') {
                console.log(`   📨 Cola ${queueName} ya existe`);
                return { queueName, exists: true };
            }
            throw new Error(`Error configurando SQS: ${error.message}`);
        }
    }

    /**
     * Configurar SNS Topic
     */
    async setupSNS() {
        const topicName = 'integration-topic';

        try {
            const result = await this.snsClient.send(new CreateTopicCommand({
                Name: topicName
            }));

            console.log(`   📢 Tópico ${topicName} creado`);

            return {
                topicName,
                topicArn: result.TopicArn
            };
        } catch (error) {
            throw new Error(`Error configurando SNS: ${error.message}`);
        }
    }

    /**
     * Configurar RDS Instance
     */
    async setupRDS() {
        const dbInstanceIdentifier = 'integration-db';

        try {
            // Verificar si la instancia ya existe
            try {
                const result = await this.rdsClient.send(new DescribeDBInstancesCommand({
                    DBInstanceIdentifier: dbInstanceIdentifier
                }));

                if (result.DBInstances && result.DBInstances.length > 0) {
                    const db = result.DBInstances[0];
                    console.log(`   🗃️ Instancia RDS ${dbInstanceIdentifier} ya existe`);
                    return {
                        dbInstanceIdentifier,
                        endpoint: db.Endpoint?.Address,
                        port: db.Endpoint?.Port,
                        status: db.DBInstanceStatus,
                        exists: true
                    };
                }
            } catch (error) {
                if (error.name !== 'DBInstanceNotFound') {
                    throw error;
                }
            }

            // Crear la instancia
            const createDBParams = {
                DBInstanceIdentifier: dbInstanceIdentifier,
                DBInstanceClass: 'db.t3.micro',
                Engine: 'mysql',
                MasterUsername: 'admin',
                MasterUserPassword: 'TempPassword123!',
                AllocatedStorage: 20,
                StorageType: 'gp2',
                VpcSecurityGroupIds: [], // Se debe configurar según la VPC
                DBSubnetGroupName: 'default', // Se debe configurar según la VPC
                BackupRetentionPeriod: 1,
                MultiAZ: false,
                PubliclyAccessible: false,
                StorageEncrypted: true,
                DeletionProtection: false
            };

            const result = await this.rdsClient.send(new CreateDBInstanceCommand(createDBParams));
            console.log(`   🗃️ Instancia RDS ${dbInstanceIdentifier} creada (esto puede tomar varios minutos)`);

            return {
                dbInstanceIdentifier,
                status: 'creating',
                exists: false
            };
        } catch (error) {
            throw new Error(`Error configurando RDS: ${error.message}`);
        }
    }

    /**
     * Configurar Lambda Functions
     */
    async setupLambda() {
        const functions = [
            {
                name: 'processFile',
                description: 'Procesa archivos subidos a S3',
                runtime: 'nodejs18.x',
                handler: 'index.processFile'
            },
            {
                name: 'processSQSMessage',
                description: 'Procesa mensajes de SQS',
                runtime: 'nodejs18.x',
                handler: 'index.processSQSMessage'
            }
        ];

        const results = [];

        for (const func of functions) {
            try {
                // Nota: En un entorno real, necesitarías crear el paquete de código
                console.log(`   ⚡ Función Lambda ${func.name} (requiere código)`);
                results.push({
                    functionName: func.name,
                    status: 'requires_code',
                    message: 'Se requiere crear el paquete de código'
                });
            } catch (error) {
                results.push({
                    functionName: func.name,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Configurar Step Functions
     */
    async setupStepFunctions() {
        const stateMachineName = 'IntegrationWorkflow';

        try {
            const stateMachineDefinition = {
                Comment: 'Workflow de integración AWS para procesamiento de archivos',
                StartAt: 'ProcessFile',
                States: {
                    ProcessFile: {
                        Type: 'Task',
                        Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:processFile',
                        Next: 'SendNotification',
                        Catch: [{
                            ErrorEquals: ['States.ALL'],
                            Next: 'HandleError',
                            ResultPath: '$.error'
                        }]
                    },
                    SendNotification: {
                        Type: 'Task',
                        Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:sendNotification',
                        End: true
                    },
                    HandleError: {
                        Type: 'Task',
                        Resource: 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:handleError',
                        End: true
                    }
                }
            };

            const createParams = {
                name: stateMachineName,
                definition: JSON.stringify(stateMachineDefinition),
                roleArn: 'arn:aws:iam::${AWS::AccountId}:role/StepFunctionsExecutionRole' // Se debe crear
            };

            console.log(`   ⚡ State Machine ${stateMachineName} (requiere rol IAM)`);

            return {
                stateMachineName,
                status: 'requires_iam_role',
                message: 'Se requiere crear el rol de ejecución'
            };
        } catch (error) {
            throw new Error(`Error configurando Step Functions: ${error.message}`);
        }
    }

    /**
     * Imprimir resultados de la configuración
     */
    printSetupResults(results) {
        console.log('📊 RESULTADOS DE LA CONFIGURACIÓN');
        console.log('='.repeat(50));

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log(`✅ Servicios configurados exitosamente: ${successful.length}`);
        console.log(`❌ Servicios con errores: ${failed.length}`);

        if (successful.length > 0) {
            console.log('\n✅ SERVICIOS EXITOSOS:');
            successful.forEach(result => {
                console.log(`   - ${result.service}`);
            });
        }

        if (failed.length > 0) {
            console.log('\n❌ SERVICIOS CON ERRORES:');
            failed.forEach(result => {
                console.log(`   - ${result.service}: ${result.error}`);
            });
        }

        console.log('\n📋 PRÓXIMOS PASOS:');
        console.log('1. Verificar que todos los servicios estén funcionando');
        console.log('2. Configurar las variables de entorno en .env');
        console.log('3. Crear los roles IAM necesarios');
        console.log('4. Implementar las funciones Lambda');
        console.log('5. Ejecutar las pruebas de integración');

        console.log('\n🔧 VARIABLES DE ENTORNO REQUERIDAS:');
        console.log('AWS_REGION=us-east-1');
        console.log('AWS_ACCESS_KEY_ID=your_access_key');
        console.log('AWS_SECRET_ACCESS_KEY=your_secret_key');
        console.log('S3_BUCKET_NAME=aws-integration-bucket');
        console.log('DYNAMODB_TABLE_NAME=integration-table');
        console.log('SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...');
        console.log('SNS_TOPIC_ARN=arn:aws:sns:us-east-1:...');
        console.log('STEP_FUNCTION_ARN=arn:aws:states:us-east-1:...');
        console.log('RDS_ENDPOINT=integration-db.cluster-xyz.us-east-1.rds.amazonaws.com');
        console.log('RDS_DATABASE_NAME=integration_db');
        console.log('RDS_USERNAME=admin');
        console.log('RDS_PASSWORD=your_password');
    }

    /**
     * Generar archivo de configuración
     */
    async generateConfigFile(results) {
        const config = {
            region: this.region,
            services: results.reduce((acc, result) => {
                if (result.success && result.result) {
                    acc[result.service.toLowerCase().replace(/\s+/g, '_')] = result.result;
                }
                return acc;
            }, {}),
            timestamp: new Date().toISOString()
        };

        const configContent = `// Configuración generada automáticamente
export const awsConfig = ${JSON.stringify(config, null, 2)};

// Variables de entorno requeridas
export const requiredEnvVars = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME',
    'DYNAMODB_TABLE_NAME',
    'SQS_QUEUE_URL',
    'SNS_TOPIC_ARN',
    'STEP_FUNCTION_ARN',
    'RDS_ENDPOINT',
    'RDS_DATABASE_NAME',
    'RDS_USERNAME',
    'RDS_PASSWORD'
];`;

        console.log('\n📄 Generando archivo de configuración...');
        console.log('Contenido del archivo config.js:');
        console.log(configContent);

        return config;
    }
}

// Ejecutar configuración si es el archivo principal
async function main() {
    const setup = new AWSServicesSetup();

    try {
        const results = await setup.setupAllServices();
        await setup.generateConfigFile(results);
    } catch (error) {
        console.error('❌ Error en la configuración:', error);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default AWSServicesSetup;
