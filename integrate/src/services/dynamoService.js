import { BatchWriteItemCommand, DeleteItemCommand, DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Servicio para operaciones con Amazon DynamoDB
 */
export class DynamoService {
    constructor(tableName) {
        this.tableName = tableName;
    }

    /**
     * Crear un nuevo item en la tabla
     */
    async putItem(item, options = {}) {
        try {
            const params = {
                TableName: this.tableName,
                Item: item,
                ...options
            };

            const result = await docClient.send(new PutItemCommand(params));

            return {
                success: true,
                result: result,
                message: 'Item creado exitosamente'
            };
        } catch (error) {
            console.error('Error creando item en DynamoDB:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener un item por clave primaria
     */
    async getItem(key, options = {}) {
        try {
            const params = {
                TableName: this.tableName,
                Key: key,
                ...options
            };

            const result = await docClient.send(new GetItemCommand(params));

            return {
                success: true,
                item: result.Item || null,
                found: !!result.Item
            };
        } catch (error) {
            console.error('Error obteniendo item de DynamoDB:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Actualizar un item existente
     */
    async updateItem(key, updateExpression, expressionAttributeValues = {}, expressionAttributeNames = {}, options = {}) {
        try {
            const params = {
                TableName: this.tableName,
                Key: key,
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: expressionAttributeNames,
                ReturnValues: 'ALL_NEW',
                ...options
            };

            const result = await docClient.send(new UpdateItemCommand(params));

            return {
                success: true,
                item: result.Attributes,
                message: 'Item actualizado exitosamente'
            };
        } catch (error) {
            console.error('Error actualizando item en DynamoDB:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Eliminar un item
     */
    async deleteItem(key, options = {}) {
        try {
            const params = {
                TableName: this.tableName,
                Key: key,
                ...options
            };

            const result = await docClient.send(new DeleteItemCommand(params));

            return {
                success: true,
                result: result,
                message: 'Item eliminado exitosamente'
            };
        } catch (error) {
            console.error('Error eliminando item de DynamoDB:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Escanear toda la tabla
     */
    async scanTable(filterExpression = null, expressionAttributeValues = {}, expressionAttributeNames = {}, options = {}) {
        try {
            const params = {
                TableName: this.tableName,
                ...options
            };

            if (filterExpression) {
                params.FilterExpression = filterExpression;
                params.ExpressionAttributeValues = expressionAttributeValues;
                params.ExpressionAttributeNames = expressionAttributeNames;
            }

            const result = await docClient.send(new ScanCommand(params));

            return {
                success: true,
                items: result.Items || [],
                count: result.Count,
                scannedCount: result.ScannedCount,
                lastEvaluatedKey: result.LastEvaluatedKey
            };
        } catch (error) {
            console.error('Error escaneando tabla de DynamoDB:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Consultar items usando clave primaria o índice
     */
    async queryItems(keyConditionExpression, expressionAttributeValues = {}, expressionAttributeNames = {}, options = {}) {
        try {
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: keyConditionExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: expressionAttributeNames,
                ...options
            };

            const result = await docClient.send(new QueryCommand(params));

            return {
                success: true,
                items: result.Items || [],
                count: result.Count,
                scannedCount: result.ScannedCount,
                lastEvaluatedKey: result.LastEvaluatedKey
            };
        } catch (error) {
            console.error('Error consultando items de DynamoDB:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Escribir múltiples items en lote
     */
    async batchWriteItems(items, options = {}) {
        try {
            const putRequests = items.map(item => ({
                PutRequest: {
                    Item: item
                }
            }));

            const params = {
                RequestItems: {
                    [this.tableName]: putRequests
                },
                ...options
            };

            const result = await client.send(new BatchWriteItemCommand(params));

            return {
                success: true,
                unprocessedItems: result.UnprocessedItems,
                message: `${items.length} items procesados en lote`
            };
        } catch (error) {
            console.error('Error escribiendo items en lote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Guardar metadatos de archivo
     */
    async saveFileMetadata(fileData) {
        const item = {
            id: fileData.id,
            originalKey: fileData.originalKey,
            bucket: fileData.bucket,
            size: fileData.size,
            contentType: fileData.contentType || 'unknown',
            uploadedAt: fileData.uploadedAt || new Date().toISOString(),
            processedAt: fileData.processedAt || null,
            status: fileData.status || 'pending',
            metadata: fileData.metadata || {},
            tags: fileData.tags || [],
            ttl: fileData.ttl || null
        };

        return await this.putItem(item);
    }

    /**
     * Obtener metadatos de archivo
     */
    async getFileMetadata(fileId) {
        return await this.getItem({ id: fileId });
    }

    /**
     * Actualizar estado de procesamiento
     */
    async updateProcessingStatus(fileId, status, details = {}) {
        const key = { id: fileId };
        const updateExpression = 'SET #status = :status, #processedAt = :processedAt, #details = :details';
        const expressionAttributeNames = {
            '#status': 'status',
            '#processedAt': 'processedAt',
            '#details': 'details'
        };
        const expressionAttributeValues = {
            ':status': status,
            ':processedAt': new Date().toISOString(),
            ':details': details
        };

        return await this.updateItem(
            key,
            updateExpression,
            expressionAttributeValues,
            expressionAttributeNames
        );
    }

    /**
     * Buscar archivos por estado
     */
    async getFilesByStatus(status) {
        const keyConditionExpression = '#status = :status';
        const expressionAttributeNames = {
            '#status': 'status'
        };
        const expressionAttributeValues = {
            ':status': status
        };

        return await this.queryItems(
            keyConditionExpression,
            expressionAttributeValues,
            expressionAttributeNames
        );
    }

    /**
     * Buscar archivos por rango de fechas
     */
    async getFilesByDateRange(startDate, endDate) {
        const filterExpression = '#uploadedAt BETWEEN :startDate AND :endDate';
        const expressionAttributeNames = {
            '#uploadedAt': 'uploadedAt'
        };
        const expressionAttributeValues = {
            ':startDate': startDate,
            ':endDate': endDate
        };

        return await this.scanTable(
            filterExpression,
            expressionAttributeValues,
            expressionAttributeNames
        );
    }

    /**
     * Buscar archivos por tipo de contenido
     */
    async getFilesByContentType(contentType) {
        const keyConditionExpression = '#contentType = :contentType';
        const expressionAttributeNames = {
            '#contentType': 'contentType'
        };
        const expressionAttributeValues = {
            ':contentType': contentType
        };

        return await this.queryItems(
            keyConditionExpression,
            expressionAttributeValues,
            expressionAttributeNames
        );
    }

    /**
     * Obtener estadísticas de archivos
     */
    async getFileStatistics() {
        try {
            const scanResult = await this.scanTable();

            if (!scanResult.success) {
                return scanResult;
            }

            const items = scanResult.items;
            const stats = {
                total: items.length,
                byStatus: {},
                byContentType: {},
                bySize: {
                    small: 0,    // < 1MB
                    medium: 0,   // 1MB - 10MB
                    large: 0     // > 10MB
                },
                totalSize: 0,
                averageSize: 0
            };

            items.forEach(item => {
                // Estadísticas por estado
                const status = item.status || 'unknown';
                stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

                // Estadísticas por tipo de contenido
                const contentType = item.contentType || 'unknown';
                stats.byContentType[contentType] = (stats.byContentType[contentType] || 0) + 1;

                // Estadísticas por tamaño
                const size = parseInt(item.size) || 0;
                stats.totalSize += size;

                if (size < 1024 * 1024) {
                    stats.bySize.small++;
                } else if (size < 10 * 1024 * 1024) {
                    stats.bySize.medium++;
                } else {
                    stats.bySize.large++;
                }
            });

            // Calcular tamaño promedio
            if (stats.total > 0) {
                stats.averageSize = stats.totalSize / stats.total;
            }

            return {
                success: true,
                statistics: stats
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
     * Crear item de procesamiento de mensaje
     */
    async saveMessageProcessing(messageId, status, data = {}) {
        const item = {
            id: `msg_${messageId}`,
            messageId: messageId,
            status: status,
            data: data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return await this.putItem(item);
    }

    /**
     * Obtener items de procesamiento de mensajes
     */
    async getMessageProcessing(messageId) {
        return await this.getItem({ id: `msg_${messageId}` });
    }

    /**
     * Configurar el nombre de la tabla
     */
    setTableName(tableName) {
        this.tableName = tableName;
    }

    /**
     * Obtener el nombre de la tabla actual
     */
    getTableName() {
        return this.tableName;
    }
}
