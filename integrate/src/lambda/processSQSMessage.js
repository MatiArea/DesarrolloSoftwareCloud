import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import mysql from 'mysql2/promise';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

/**
 * Función Lambda para procesar mensajes de SQS
 * Esta función se activa cuando hay mensajes en la cola SQS
 */
export const processSQSMessage = async (event) => {
    console.log('Procesando mensajes de SQS:', JSON.stringify(event, null, 2));

    const results = [];

    for (const record of event.Records) {
        try {
            console.log(`Procesando mensaje: ${record.messageId}`);

            // Parsear el mensaje
            const messageBody = JSON.parse(record.body);
            const { type, metadata } = messageBody;

            // Procesar según el tipo de mensaje
            let result;
            switch (type) {
                case 'file_processed':
                    result = await processFileMessage(metadata);
                    break;
                case 'data_sync':
                    result = await processDataSync(metadata);
                    break;
                default:
                    result = await processGenericMessage(messageBody);
            }

            // Actualizar estado en DynamoDB
            await updateProcessingStatus(record.messageId, 'completed', result);

            results.push({
                messageId: record.messageId,
                status: 'success',
                result: result
            });

        } catch (error) {
            console.error(`Error procesando mensaje ${record.messageId}:`, error);

            // Actualizar estado de error en DynamoDB
            await updateProcessingStatus(record.messageId, 'failed', { error: error.message });

            results.push({
                messageId: record.messageId,
                status: 'error',
                error: error.message
            });
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            processedCount: results.length,
            results: results
        })
    };
};

/**
 * Procesar mensaje de archivo
 */
async function processFileMessage(metadata) {
    console.log('Procesando mensaje de archivo:', metadata.id);

    // Obtener datos de DynamoDB
    const dynamoData = await getFromDynamoDB(metadata.id);

    // Sincronizar con RDS
    const rdsResult = await syncWithRDS(dynamoData);

    // Realizar análisis de datos
    const analysis = await analyzeData(dynamoData);

    return {
        type: 'file_processing',
        dynamoData: dynamoData,
        rdsSync: rdsResult,
        analysis: analysis,
        processedAt: new Date().toISOString()
    };
}

/**
 * Procesar sincronización de datos
 */
async function processDataSync(metadata) {
    console.log('Procesando sincronización de datos');

    // Obtener datos de DynamoDB
    const dynamoItems = await getAllFromDynamoDB();

    // Sincronizar con RDS
    const syncResults = [];
    for (const item of dynamoItems) {
        const syncResult = await syncWithRDS(item);
        syncResults.push(syncResult);
    }

    return {
        type: 'data_sync',
        itemsProcessed: dynamoItems.length,
        syncResults: syncResults,
        completedAt: new Date().toISOString()
    };
}

/**
 * Procesar mensaje genérico
 */
async function processGenericMessage(messageBody) {
    console.log('Procesando mensaje no compatible con el flujo');

    return {
        type: 'generic',
        originalMessage: messageBody,
        processedAt: new Date().toISOString()
    };
}

/**
 * Obtener datos de DynamoDB
 */
async function getFromDynamoDB(id) {
    const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: {
            id: { S: id }
        }
    };

    const result = await dynamoClient.send(new GetItemCommand(params));
    return result.Item ? parseDynamoItem(result.Item) : null;
}

/**
 * Obtener todos los elementos de DynamoDB
 */
async function getAllFromDynamoDB() {
    // TODO: Implementar funcion para obtener todos los elementos de DynamoDB
    return [];
}

/**
 * Sincronizar datos con RDS
 */
async function syncWithRDS(dynamoData) {
    if (!dynamoData) {
        return { status: 'skipped', reason: 'No data to sync' };
    }

    try {
        // Crear conexión a RDS
        const connection = await mysql.createConnection({
            host: process.env.RDS_ENDPOINT,
            port: process.env.RDS_PORT || 3306,
            user: process.env.RDS_USERNAME,
            password: process.env.RDS_PASSWORD,
            database: process.env.RDS_DATABASE_NAME
        });

        // Insertar o actualizar datos en RDS
        const query = `
            INSERT INTO file_metadata 
            (id, original_key, bucket, size, processed_at, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
            bucket = VALUES(bucket),
            size = VALUES(size),
            processed_at = VALUES(processed_at),
            data = VALUES(data),
            updated_at = NOW()
        `;

        const values = [
            dynamoData.id,
            dynamoData.originalKey,
            dynamoData.bucket,
            parseInt(dynamoData.size),
            dynamoData.processedAt,
            JSON.stringify(dynamoData.data)
        ];

        const [result] = await connection.execute(query, values);
        await connection.end();

        return {
            status: 'success',
            rdsResult: result,
            syncedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error sincronizando con RDS:', error);
        return {
            status: 'error',
            error: error.message,
            attemptedAt: new Date().toISOString()
        };
    }
}

/**
 * Analizar datos
 */
async function analyzeData(dynamoData) {
    const analysis = {
        id: dynamoData.id,
        fileSize: parseInt(dynamoData.size),
        dataType: dynamoData.data.type || 'unknown',
        hasJsonData: typeof dynamoData.data === 'object',
        analysisTimestamp: new Date().toISOString()
    };

    // Análisis básico del contenido
    if (dynamoData.data.content) {
        analysis.contentLength = dynamoData.data.content.length;
        analysis.wordCount = dynamoData.data.content.split(/\s+/).length;
    }

    return analysis;
}

/**
 * Actualizar estado de procesamiento en DynamoDB
 */
async function updateProcessingStatus(messageId, status, result) {
    const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Key: {
            id: { S: `processing_${messageId}` }
        },
        UpdateExpression: 'SET #status = :status, #result = :result, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#result': 'result',
            '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: {
            ':status': { S: status },
            ':result': { S: JSON.stringify(result) },
            ':updatedAt': { S: new Date().toISOString() }
        }
    };

    await dynamoClient.send(new UpdateItemCommand(params));
}

/**
 * Parsear elemento de DynamoDB
 */
function parseDynamoItem(item) {
    const parsed = {};
    for (const [key, value] of Object.entries(item)) {
        if (value.S) parsed[key] = value.S;
        else if (value.N) parsed[key] = value.N;
        else if (value.BOOL !== undefined) parsed[key] = value.BOOL;
        else if (value.SS) parsed[key] = value.SS;
        else if (value.NS) parsed[key] = value.NS;
    }
    return parsed;
}
