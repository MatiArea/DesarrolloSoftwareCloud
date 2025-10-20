import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

/**
 * Función Lambda para procesar archivos subidos a S3
 * Esta función se activa cuando se sube un archivo al bucket S3
 */
export const processFile = async (event) => {
    console.log('Evento recibido:', JSON.stringify(event, null, 2));

    try {
        // Extraer información del evento S3
        const record = event.Records[0];
        const bucketName = record.s3.bucket.name;
        const objectKey = record.s3.object.key;

        console.log(`Procesando archivo: ${objectKey} del bucket: ${bucketName}`);

        // Obtener el archivo de S3
        const getObjectParams = {
            Bucket: bucketName,
            Key: objectKey
        };

        const getObjectResponse = await s3Client.send(new GetObjectCommand(getObjectParams));
        const fileContent = await streamToString(getObjectResponse.Body);

        // Procesar el contenido del archivo (ejemplo: parsear JSON)
        let processedData;
        try {
            processedData = JSON.parse(fileContent);
        } catch (parseError) {
            processedData = {
                content: fileContent,
                type: 'text',
                processed: new Date().toISOString()
            };
        }

        // Agregar metadatos
        const fileMetadata = {
            id: objectKey.replace(/[^a-zA-Z0-9]/g, '_'),
            originalKey: objectKey,
            bucket: bucketName,
            size: record.s3.object.size,
            processedAt: new Date().toISOString(),
            data: processedData
        };

        // Guardar en DynamoDB
        await saveToDynamoDB(fileMetadata);

        // Enviar mensaje a SQS para procesamiento adicional
        await sendToSQS(fileMetadata);

        // Enviar notificación SNS
        await sendNotification(fileMetadata);

        // Crear un archivo de resultado en S3
        const resultKey = `processed/${objectKey}_result.json`;
        await saveResultToS3(bucketName, resultKey, fileMetadata);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Archivo procesado exitosamente',
                metadata: fileMetadata
            })
        };

    } catch (error) {
        console.error('Error procesando archivo:', error);

        // Enviar notificación de error
        await sendErrorNotification(error, event);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Error procesando archivo',
                details: error.message
            })
        };
    }
};

/**
 * Función auxiliar para convertir stream a string
 */
async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Guardar metadatos en DynamoDB
 */
async function saveToDynamoDB(metadata) {
    const params = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Item: {
            id: { S: metadata.id },
            originalKey: { S: metadata.originalKey },
            bucket: { S: metadata.bucket },
            size: { N: metadata.size.toString() },
            processedAt: { S: metadata.processedAt },
            data: { S: JSON.stringify(metadata.data) }
        }
    };

    await dynamoClient.send(new PutItemCommand(params));
    console.log('Metadatos guardados en DynamoDB');
}

/**
 * Enviar mensaje a SQS
 */
async function sendToSQS(metadata) {
    const params = {
        QueueUrl: process.env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify({
            type: 'file_processed',
            metadata: metadata,
            timestamp: new Date().toISOString()
        }),
        MessageAttributes: {
            fileType: {
                DataType: 'String',
                StringValue: metadata.data.type || 'unknown'
            },
            fileSize: {
                DataType: 'Number',
                StringValue: metadata.size.toString()
            }
        }
    };

    const result = await sqsClient.send(new SendMessageCommand(params));
    console.log('Mensaje enviado a SQS:', result.MessageId);
}

/**
 * Enviar notificación SNS
 */
async function sendNotification(metadata) {
    const params = {
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: 'Archivo procesado exitosamente',
        Message: JSON.stringify({
            message: `El archivo ${metadata.originalKey} ha sido procesado exitosamente`,
            details: {
                id: metadata.id,
                size: metadata.size,
                processedAt: metadata.processedAt
            }
        }, null, 2)
    };

    const result = await snsClient.send(new PublishCommand(params));
    console.log('Notificación enviada a SNS:', result.MessageId);
}

/**
 * Guardar resultado en S3
 */
async function saveResultToS3(bucketName, key, data) {
    const params = {
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json'
    };

    await s3Client.send(new PutObjectCommand(params));
    console.log('Resultado guardado en S3:', key);
}

/**
 * Enviar notificación de error
 */
async function sendErrorNotification(error, event) {
    try {
        const params = {
            TopicArn: process.env.SNS_TOPIC_ARN,
            Subject: 'Error procesando archivo',
            Message: JSON.stringify({
                error: error.message,
                event: event,
                timestamp: new Date().toISOString()
            }, null, 2)
        };

        await snsClient.send(new PublishCommand(params));
    } catch (notificationError) {
        console.error('Error enviando notificación de error:', notificationError);
    }
}
