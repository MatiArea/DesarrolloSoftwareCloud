import { DeleteMessageCommand, GetQueueAttributesCommand, ReceiveMessageCommand, SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

/**
 * Servicio para operaciones con Amazon SQS
 */
export class SQSService {
    constructor(queueUrl) {
        this.queueUrl = queueUrl;
    }

    /**
     * Enviar mensaje a la cola
     */
    async sendMessage(messageBody, messageAttributes = {}, delaySeconds = 0) {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
                MessageAttributes: this.formatMessageAttributes(messageAttributes),
                DelaySeconds: delaySeconds
            };

            const result = await sqsClient.send(new SendMessageCommand(params));

            return {
                success: true,
                messageId: result.MessageId,
                md5OfBody: result.MD5OfBody,
                message: 'Mensaje enviado exitosamente'
            };
        } catch (error) {
            console.error('Error enviando mensaje a SQS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enviar mensaje en lote
     */
    async sendBatchMessages(messages) {
        try {
            const results = [];

            // SQS permite máximo 10 mensajes por lote
            const batchSize = 10;
            for (let i = 0; i < messages.length; i += batchSize) {
                const batch = messages.slice(i, i + batchSize);

                for (const message of batch) {
                    const result = await this.sendMessage(
                        message.body,
                        message.attributes || {},
                        message.delaySeconds || 0
                    );
                    results.push(result);
                }
            }

            return {
                success: true,
                results: results,
                totalProcessed: results.length
            };
        } catch (error) {
            console.error('Error enviando mensajes en lote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Recibir mensajes de la cola
     */
    async receiveMessages(maxMessages = 10, waitTimeSeconds = 20, visibilityTimeoutSeconds = 30) {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                MaxNumberOfMessages: maxMessages,
                WaitTimeSeconds: waitTimeSeconds,
                VisibilityTimeoutSeconds: visibilityTimeoutSeconds,
                MessageAttributeNames: ['All'],
                AttributeNames: ['All']
            };

            const result = await sqsClient.send(new ReceiveMessageCommand(params));

            const messages = result.Messages?.map(msg => ({
                messageId: msg.MessageId,
                receiptHandle: msg.ReceiptHandle,
                body: msg.Body,
                attributes: msg.MessageAttributes || {},
                systemAttributes: msg.Attributes || {},
                md5OfBody: msg.MD5OfBody
            })) || [];

            return {
                success: true,
                messages: messages,
                messageCount: messages.length
            };
        } catch (error) {
            console.error('Error recibiendo mensajes de SQS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Eliminar mensaje de la cola
     */
    async deleteMessage(receiptHandle) {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                ReceiptHandle: receiptHandle
            };

            await sqsClient.send(new DeleteMessageCommand(params));

            return {
                success: true,
                message: 'Mensaje eliminado exitosamente'
            };
        } catch (error) {
            console.error('Error eliminando mensaje de SQS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Eliminar mensajes en lote
     */
    async deleteBatchMessages(receiptHandles) {
        try {
            const results = [];

            for (const receiptHandle of receiptHandles) {
                const result = await this.deleteMessage(receiptHandle);
                results.push(result);
            }

            return {
                success: true,
                results: results,
                totalProcessed: results.length
            };
        } catch (error) {
            console.error('Error eliminando mensajes en lote:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener atributos de la cola
     */
    async getQueueAttributes(attributeNames = ['All']) {
        try {
            const params = {
                QueueUrl: this.queueUrl,
                AttributeNames: attributeNames
            };

            const result = await sqsClient.send(new GetQueueAttributesCommand(params));

            return {
                success: true,
                attributes: result.Attributes
            };
        } catch (error) {
            console.error('Error obteniendo atributos de la cola:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estadísticas de la cola
     */
    async getQueueStats() {
        try {
            const result = await this.getQueueAttributes([
                'ApproximateNumberOfMessages',
                'ApproximateNumberOfMessagesNotVisible',
                'ApproximateNumberOfMessagesDelayed'
            ]);

            if (!result.success) {
                return result;
            }

            const stats = {
                messagesAvailable: parseInt(result.attributes.ApproximateNumberOfMessages || '0'),
                messagesInFlight: parseInt(result.attributes.ApproximateNumberOfMessagesNotVisible || '0'),
                messagesDelayed: parseInt(result.attributes.ApproximateNumberOfMessagesDelayed || '0'),
                totalMessages: parseInt(result.attributes.ApproximateNumberOfMessages || '0') +
                    parseInt(result.attributes.ApproximateNumberOfMessagesNotVisible || '0') +
                    parseInt(result.attributes.ApproximateNumberOfMessagesDelayed || '0')
            };

            return {
                success: true,
                stats: stats
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de la cola:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Procesar mensajes con callback
     */
    async processMessages(processorFunction, options = {}) {
        const {
            maxMessages = 10,
            waitTimeSeconds = 20,
            visibilityTimeoutSeconds = 30,
            continueOnError = true,
            maxIterations = 100
        } = options;

        let iterations = 0;
        const results = [];

        while (iterations < maxIterations) {
            try {
                // Recibir mensajes
                const receiveResult = await this.receiveMessages(
                    maxMessages,
                    waitTimeSeconds,
                    visibilityTimeoutSeconds
                );

                if (!receiveResult.success) {
                    console.error('Error recibiendo mensajes:', receiveResult.error);
                    break;
                }

                if (receiveResult.messages.length === 0) {
                    console.log('No hay más mensajes para procesar');
                    break;
                }

                // Procesar cada mensaje
                for (const message of receiveResult.messages) {
                    try {
                        const processResult = await processorFunction(message);
                        results.push({
                            messageId: message.messageId,
                            success: true,
                            result: processResult
                        });

                        // Eliminar mensaje procesado
                        await this.deleteMessage(message.receiptHandle);
                    } catch (error) {
                        console.error(`Error procesando mensaje ${message.messageId}:`, error);
                        results.push({
                            messageId: message.messageId,
                            success: false,
                            error: error.message
                        });

                        if (!continueOnError) {
                            throw error;
                        }
                    }
                }

                iterations++;
            } catch (error) {
                console.error('Error en procesamiento de mensajes:', error);
                if (!continueOnError) {
                    break;
                }
            }
        }

        return {
            success: true,
            processedCount: results.length,
            results: results,
            iterations: iterations
        };
    }

    /**
     * Formatear atributos de mensaje
     */
    formatMessageAttributes(attributes) {
        const formatted = {};

        for (const [key, value] of Object.entries(attributes)) {
            if (typeof value === 'string') {
                formatted[key] = {
                    DataType: 'String',
                    StringValue: value
                };
            } else if (typeof value === 'number') {
                formatted[key] = {
                    DataType: 'Number',
                    StringValue: value.toString()
                };
            } else if (typeof value === 'boolean') {
                formatted[key] = {
                    DataType: 'String',
                    StringValue: value.toString()
                };
            }
        }

        return formatted;
    }

    /**
     * Enviar mensaje de notificación
     */
    async sendNotification(type, data, priority = 'normal') {
        const message = {
            type: 'notification',
            notificationType: type,
            data: data,
            priority: priority,
            timestamp: new Date().toISOString()
        };

        const attributes = {
            notificationType: type,
            priority: priority
        };

        return await this.sendMessage(message, attributes);
    }

    /**
     * Enviar mensaje de tarea
     */
    async sendTask(taskType, taskData, delaySeconds = 0) {
        const message = {
            type: 'task',
            taskType: taskType,
            taskData: taskData,
            createdAt: new Date().toISOString()
        };

        const attributes = {
            taskType: taskType
        };

        return await this.sendMessage(message, attributes, delaySeconds);
    }
}
