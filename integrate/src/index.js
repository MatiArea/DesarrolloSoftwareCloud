import { DynamoService } from './services/dynamoService.js';
import { RDSService } from './services/rdsService.js';
import { S3Service } from './services/s3Service.js';
import { SNSService } from './services/snsService.js';
import { SQSService } from './services/sqsService.js';
import { StepFunctionsService } from './services/stepFunctionsService.js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Cargar variables de entorno
dotenv.config();

/**
 * Aplicación principal que integra todos los servicios AWS
 */
export class AWSIntegrationApp {
    constructor() {
        this.s3Service = new S3Service(process.env.S3_BUCKET_NAME);
        this.sqsService = new SQSService(process.env.SQS_QUEUE_URL);
        this.snsService = new SNSService(process.env.SNS_TOPIC_ARN);
        this.stepFunctionsService = new StepFunctionsService(process.env.STEP_FUNCTION_ARN);
        this.dynamoService = new DynamoService(process.env.DYNAMODB_TABLE_NAME);
        this.rdsService = new RDSService();

        this.isInitialized = false;
    }

    /**
     * Inicializar todos los servicios
     */
    async initialize() {
        try {
            console.log('🚀 Inicializando aplicación de integración AWS...');

            // Inicializar RDS
            console.log('Inicializando RDS...');
            const rdsInit = await this.rdsService.connect();
            if (!rdsInit.success) {
                throw new Error(`Error inicializando RDS: ${rdsInit.error}`);
            }

            const schemaInit = await this.rdsService.initializeSchema();
            if (!schemaInit.success) {
                throw new Error(`Error inicializando esquema RDS: ${schemaInit.error}`);
            }

            console.log('RDS inicializado correctamente');

            this.isInitialized = true;
            console.log('Aplicación inicializada exitosamente');

            return {
                success: true,
                message: 'Aplicación inicializada correctamente'
            };
        } catch (error) {
            console.error('Error inicializando aplicación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Procesar archivo completo - flujo principal de integración
     */
    async processFileComplete(fileName, fileContent, contentType = 'application/octet-stream') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const fileId = uuidv4();
            console.log(`Procesando archivo: ${fileName} (ID: ${fileId})`);

            // 1. Subir archivo a S3
            console.log('Subiendo archivo a S3...');
            const uploadResult = await this.s3Service.uploadFile(fileName, fileContent, contentType, {
                fileId: fileId,
                folder: 'uploads'
            });

            if (!uploadResult.success) {
                throw new Error(`Error subiendo archivo: ${uploadResult.error}`);
            }

            // 2. Guardar metadatos en DynamoDB
            console.log('Guardando metadatos en DynamoDB...');
            const fileMetadata = {
                id: fileId,
                originalKey: uploadResult.key,
                bucket: process.env.S3_BUCKET_NAME,
                size: fileContent.length,
                contentType: contentType,
                uploadedAt: new Date().toISOString(),
                status: 'uploaded'
            };

            const dynamoResult = await this.dynamoService.saveFileMetadata(fileMetadata);
            if (!dynamoResult.success) {
                throw new Error(`Error guardando en DynamoDB: ${dynamoResult.error}`);
            }

            // 3. Guardar metadatos en RDS
            console.log('Sincronizando con RDS...');
            const rdsResult = await this.rdsService.saveFileMetadata(fileMetadata);
            if (!rdsResult.success) {
                console.warn(`Advertencia: Error sincronizando con RDS: ${rdsResult.error}`);
            }

            // 4. Enviar mensaje a SQS para procesamiento
            console.log('Enviando mensaje a SQS...');
            const sqsMessage = {
                type: 'file_processing',
                fileMetadata: fileMetadata,
                timestamp: new Date().toISOString()
            };

            const sqsResult = await this.sqsService.sendMessage(sqsMessage, {
                fileId: fileId,
                contentType: contentType
            });

            if (!sqsResult.success) {
                throw new Error(`Error enviando a SQS: ${sqsResult.error}`);
            }

            // 5. Enviar notificación SNS
            console.log('Enviando notificación SNS...');
            const snsResult = await this.snsService.sendFileProcessingNotification(
                { id: fileId, name: fileName, key: uploadResult.key },
                'uploaded',
                { size: fileContent.length, contentType: contentType }
            );

            if (!snsResult.success) {
                console.warn(`Advertencia: Error enviando notificación SNS: ${snsResult.error}`);
            }

            // 6. Iniciar workflow de Step Functions
            console.log('Iniciando workflow de Step Functions...');
            const stepFunctionResult = await this.stepFunctionsService.startFileProcessingWorkflow(
                fileMetadata,
                {
                    processImages: contentType.startsWith('image/'),
                    extractText: contentType.startsWith('text/'),
                    generateThumbnails: contentType.startsWith('image/')
                }
            );

            if (!stepFunctionResult.success) {
                console.warn(`Advertencia: Error iniciando Step Functions: ${stepFunctionResult.error}`);
            }

            console.log('Archivo procesado exitosamente');

            return {
                success: true,
                fileId: fileId,
                s3Key: uploadResult.key,
                s3Location: uploadResult.location,
                sqsMessageId: sqsResult.messageId,
                stepFunctionExecution: stepFunctionResult.executionArn,
                metadata: fileMetadata
            };

        } catch (error) {
            console.error('Error procesando archivo:', error);

            // Enviar notificación de error
            await this.snsService.sendErrorNotification(error, {
                fileName: fileName,
                fileId: fileId,
                operation: 'processFileComplete'
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Procesar mensaje de SQS
     */
    async processSQSMessage(messageData) {
        try {
            console.log('Procesando mensaje de SQS:', messageData.messageId);

            // Actualizar estado en DynamoDB
            await this.dynamoService.saveMessageProcessing({
                id: `msg_${messageData.messageId}`,
                messageId: messageData.messageId,
                queueName: 'integration-queue',
                status: 'processing',
                data: messageData
            });

            // Procesar según el tipo de mensaje
            let result;
            switch (messageData.type) {
                case 'file_processing':
                    result = await this.processFileMessage(messageData.fileMetadata);
                    break;
                case 'data_sync':
                    result = await this.processDataSync(messageData);
                    break;
                default:
                    result = { type: 'generic', processedAt: new Date().toISOString() };
            }

            // Actualizar estado de completado
            await this.dynamoService.saveMessageProcessing({
                id: `msg_${messageData.messageId}`,
                messageId: messageData.messageId,
                queueName: 'integration-queue',
                status: 'completed',
                data: { ...messageData, result: result }
            });

            // Enviar notificación de éxito
            await this.snsService.sendSuccessNotification('sqs_message_processing', {
                messageId: messageData.messageId,
                result: result
            });

            return {
                success: true,
                result: result
            };

        } catch (error) {
            console.error('Error procesando mensaje SQS:', error);

            // Actualizar estado de error
            await this.dynamoService.saveMessageProcessing({
                id: `msg_${messageData.messageId}`,
                messageId: messageData.messageId,
                queueName: 'integration-queue',
                status: 'failed',
                data: { ...messageData, error: error.message }
            });

            // Enviar notificación de error
            await this.snsService.sendErrorNotification(error, {
                messageId: messageData.messageId,
                operation: 'processSQSMessage'
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Procesar mensaje de archivo
     */
    async processFileMessage(fileMetadata) {
        console.log('Procesando mensaje de archivo:', fileMetadata.id);

        // Obtener archivo de S3
        const downloadResult = await this.s3Service.downloadFile(fileMetadata.originalKey);
        if (!downloadResult.success) {
            throw new Error(`Error descargando archivo: ${downloadResult.error}`);
        }

        // Procesar contenido
        let processedData;
        try {
            if (fileMetadata.contentType.startsWith('application/json')) {
                processedData = JSON.parse(downloadResult.content.toString());
            } else if (fileMetadata.contentType.startsWith('text/')) {
                processedData = {
                    content: downloadResult.content.toString(),
                    wordCount: downloadResult.content.toString().split(/\s+/).length,
                    lineCount: downloadResult.content.toString().split('\n').length
                };
            } else {
                processedData = {
                    type: 'binary',
                    size: downloadResult.content.length,
                    processed: new Date().toISOString()
                };
            }
        } catch (parseError) {
            processedData = {
                content: downloadResult.content.toString(),
                parseError: parseError.message,
                processed: new Date().toISOString()
            };
        }

        // Actualizar metadatos en DynamoDB
        const updatedMetadata = {
            ...fileMetadata,
            status: 'processed',
            processedAt: new Date().toISOString(),
            data: processedData
        };

        await this.dynamoService.updateFileProcessingStatus(fileMetadata.id, 'completed', {
            processedData: processedData,
            processingTime: new Date().toISOString()
        });

        // Sincronizar con RDS
        await this.rdsService.updateFileProcessingStatus(fileMetadata.id, 'completed', {
            processedData: processedData
        });

        // Guardar resultado procesado en S3
        const resultKey = `processed/${fileMetadata.originalKey}_result.json`;
        await this.s3Service.uploadJsonFile(
            `${fileMetadata.id}_result`,
            processedData,
            'results'
        );

        return {
            type: 'file_processing',
            fileId: fileMetadata.id,
            processedData: processedData,
            processedAt: new Date().toISOString()
        };
    }

    /**
     * Procesar sincronización de datos
     */
    async processDataSync() {
        console.log('Procesando sincronización de datos');

        // Obtener todos los elementos de DynamoDB
        const dynamoResult = await this.dynamoService.scanTable();
        if (!dynamoResult.success) {
            throw new Error(`Error obteniendo datos de DynamoDB: ${dynamoResult.error}`);
        }

        // Sincronizar cada elemento con RDS
        const syncResults = [];
        for (const item of dynamoResult.items) {
            try {
                const syncResult = await this.rdsService.saveFileMetadata(item);
                syncResults.push({
                    id: item.id,
                    success: syncResult.success,
                    result: syncResult
                });
            } catch (error) {
                syncResults.push({
                    id: item.id,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            type: 'data_sync',
            itemsProcessed: dynamoResult.items.length,
            syncResults: syncResults,
            completedAt: new Date().toISOString()
        };
    }

    /**
     * Obtener estadísticas del sistema
     */
    async getSystemStatistics() {
        try {
            console.log('Obteniendo estadísticas del sistema...');

            // Estadísticas de archivos
            const fileStats = await this.rdsService.getFileStatistics();

            // Estadísticas de mensajes
            const messageStats = await this.rdsService.getMessageProcessingStatistics();

            // Estadísticas de Step Functions
            const stepFunctionStats = await this.stepFunctionsService.getExecutionStatistics();

            // Estadísticas de SQS
            const sqsStats = await this.sqsService.getQueueStats();

            // Estadísticas de S3
            const s3Files = await this.s3Service.listFiles();

            const statistics = {
                timestamp: new Date().toISOString(),
                files: fileStats.success ? fileStats.rows : null,
                messages: messageStats.success ? messageStats.rows : null,
                stepFunctions: stepFunctionStats.success ? stepFunctionStats.statistics : null,
                sqs: sqsStats.success ? sqsStats.stats : null,
                s3: s3Files.success ? {
                    totalFiles: s3Files.files.length,
                    files: s3Files.files
                } : null
            };

            // Guardar estadísticas en RDS
            await this.rdsService.saveSystemMetric('system_statistics', 1, 'count', statistics);

            return {
                success: true,
                statistics: statistics
            };

        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Ejecutar flujo completo de ejemplo
     */
    async runExampleFlow() {
        try {
            console.log('Ejecutando flujo completo de ejemplo...');

            // 1. Crear archivo de ejemplo
            const exampleData = {
                message: 'Hola desde AWS Integration!',
                timestamp: new Date().toISOString(),
                services: ['S3', 'Lambda', 'SQS', 'Step Functions', 'SNS', 'DynamoDB', 'RDS'],
                version: '1.0.0'
            };

            const fileName = `example_${Date.now()}.json`;
            const fileContent = JSON.stringify(exampleData, null, 2);

            // 2. Procesar archivo completo
            const processResult = await this.processFileComplete(fileName, fileContent, 'application/json');

            if (!processResult.success) {
                throw new Error(`Error procesando archivo: ${processResult.error}`);
            }

            // 3. Simular procesamiento de mensaje SQS
            const sqsMessage = {
                type: 'file_processing',
                fileMetadata: processResult.metadata,
                timestamp: new Date().toISOString()
            };

            const messageResult = await this.processSQSMessage(sqsMessage);

            if (!messageResult.success) {
                throw new Error(`Error procesando mensaje: ${messageResult.error}`);
            }

            // 4. Obtener estadísticas
            const statsResult = await this.getSystemStatistics();

            console.log('Flujo completo ejecutado exitosamente');

            return {
                success: true,
                fileProcessing: processResult,
                messageProcessing: messageResult,
                statistics: statsResult,
                summary: {
                    fileId: processResult.fileId,
                    s3Key: processResult.s3Key,
                    sqsMessageId: processResult.sqsMessageId,
                    stepFunctionExecution: processResult.stepFunctionExecution,
                    processedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Error en flujo de ejemplo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Función principal para ejecutar la aplicación
async function main() {
    const app = new AWSIntegrationApp();

    try {
        // Inicializar aplicación
        const initResult = await app.initialize();
        if (!initResult.success) {
            throw new Error(initResult.error);
        }

        // Ejecutar flujo de ejemplo
        const result = await app.runExampleFlow();

        if (result.success) {
            console.log('\n Resumen:');
            console.log(`  - Archivo ID: ${result.summary.fileId}`);
            console.log(`  - S3 Key: ${result.summary.s3Key}`);
            console.log(`  - SQS Message ID: ${result.summary.sqsMessageId}`);
            console.log(`  - Step Function: ${result.summary.stepFunctionExecution}`);
        } else {
            console.error('Error en el flujo:', result.error);
        }

    } catch (error) {
        console.error('Error en la aplicación:', error);
    }
}

// Ejecutar si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default AWSIntegrationApp;
