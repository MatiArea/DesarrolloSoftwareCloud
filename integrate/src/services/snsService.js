import { CreateTopicCommand, ListSubscriptionsByTopicCommand, ListTopicsCommand, PublishCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

/**
 * Servicio para operaciones con Amazon SNS
 */
export class SNSService {
    constructor(topicArn = null) {
        this.topicArn = topicArn;
    }

    /**
     * Crear un nuevo tópico
     */
    async createTopic(topicName, displayName = null) {
        try {
            const params = {
                Name: topicName
            };

            if (displayName) {
                params.DisplayName = displayName;
            }

            const result = await snsClient.send(new CreateTopicCommand(params));

            return {
                success: true,
                topicArn: result.TopicArn,
                message: 'Tópico creado exitosamente'
            };
        } catch (error) {
            console.error('Error creando tópico:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Listar todos los tópicos
     */
    async listTopics() {
        try {
            const result = await snsClient.send(new ListTopicsCommand({}));

            const topics = result.Topics?.map(topic => ({
                topicArn: topic.TopicArn
            })) || [];

            return {
                success: true,
                topics: topics
            };
        } catch (error) {
            console.error('Error listando tópicos:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Publicar mensaje en el tópico
     */
    async publishMessage(subject, message, messageAttributes = {}) {
        if (!this.topicArn) {
            return {
                success: false,
                error: 'Topic ARN no configurado'
            };
        }

        try {
            const params = {
                TopicArn: this.topicArn,
                Subject: subject,
                Message: typeof message === 'string' ? message : JSON.stringify(message),
                MessageAttributes: this.formatMessageAttributes(messageAttributes)
            };

            const result = await snsClient.send(new PublishCommand(params));

            return {
                success: true,
                messageId: result.MessageId,
                message: 'Mensaje publicado exitosamente'
            };
        } catch (error) {
            console.error('Error publicando mensaje:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Publicar mensaje a un endpoint específico
     */
    async publishToEndpoint(endpoint, subject, message, messageAttributes = {}) {
        try {
            const params = {
                TargetArn: endpoint,
                Subject: subject,
                Message: typeof message === 'string' ? message : JSON.stringify(message),
                MessageAttributes: this.formatMessageAttributes(messageAttributes)
            };

            const result = await snsClient.send(new PublishCommand(params));

            return {
                success: true,
                messageId: result.MessageId,
                message: 'Mensaje enviado al endpoint exitosamente'
            };
        } catch (error) {
            console.error('Error enviando mensaje al endpoint:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Suscribirse a un tópico
     */
    async subscribe(protocol, endpoint, topicArn = null) {
        const targetTopicArn = topicArn || this.topicArn;

        if (!targetTopicArn) {
            return {
                success: false,
                error: 'Topic ARN no especificado'
            };
        }

        try {
            const params = {
                TopicArn: targetTopicArn,
                Protocol: protocol,
                Endpoint: endpoint
            };

            const result = await snsClient.send(new SubscribeCommand(params));

            return {
                success: true,
                subscriptionArn: result.SubscriptionArn,
                message: 'Suscripción creada exitosamente'
            };
        } catch (error) {
            console.error('Error creando suscripción:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Listar suscripciones de un tópico
     */
    async listSubscriptions(topicArn = null) {
        const targetTopicArn = topicArn || this.topicArn;

        if (!targetTopicArn) {
            return {
                success: false,
                error: 'Topic ARN no especificado'
            };
        }

        try {
            const params = {
                TopicArn: targetTopicArn
            };

            const result = await snsClient.send(new ListSubscriptionsByTopicCommand(params));

            const subscriptions = result.Subscriptions?.map(sub => ({
                subscriptionArn: sub.SubscriptionArn,
                protocol: sub.Protocol,
                endpoint: sub.Endpoint,
                owner: sub.Owner
            })) || [];

            return {
                success: true,
                subscriptions: subscriptions
            };
        } catch (error) {
            console.error('Error listando suscripciones:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enviar notificación de sistema
     */
    async sendSystemNotification(type, data, severity = 'info') {
        const notification = {
            type: 'system',
            notificationType: type,
            data: data,
            severity: severity,
            timestamp: new Date().toISOString()
        };

        const subject = `[${severity.toUpperCase()}] Sistema: ${type}`;
        const attributes = {
            type: { DataType: 'String', StringValue: 'system' },
            notificationType: { DataType: 'String', StringValue: type },
            severity: { DataType: 'String', StringValue: severity }
        };

        return await this.publishMessage(subject, notification, attributes);
    }

    /**
     * Enviar notificación de error
     */
    async sendErrorNotification(error, context = {}) {
        const errorNotification = {
            type: 'error',
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            context: context,
            timestamp: new Date().toISOString()
        };

        const subject = '[ERROR] Error en el sistema';
        const attributes = {
            type: { DataType: 'String', StringValue: 'error' },
            severity: { DataType: 'String', StringValue: 'high' }
        };

        return await this.publishMessage(subject, errorNotification, attributes);
    }

    /**
     * Enviar notificación de éxito
     */
    async sendSuccessNotification(operation, details = {}) {
        const successNotification = {
            type: 'success',
            operation: operation,
            details: details,
            timestamp: new Date().toISOString()
        };

        const subject = '[SUCCESS] Operación completada exitosamente';
        const attributes = {
            type: { DataType: 'String', StringValue: 'success' },
            operation: { DataType: 'String', StringValue: operation },
            severity: { DataType: 'String', StringValue: 'info' }
        };

        return await this.publishMessage(subject, successNotification, attributes);
    }

    /**
     * Enviar notificación de procesamiento de archivo
     */
    async sendFileProcessingNotification(fileInfo, status, details = {}) {
        const notification = {
            type: 'file_processing',
            fileInfo: fileInfo,
            status: status,
            details: details,
            timestamp: new Date().toISOString()
        };

        const subject = `[FILE] ${status}: ${fileInfo.name || fileInfo.key}`;
        const attributes = {
            type: { DataType: 'String', StringValue: 'file_processing' },
            status: { DataType: 'String', StringValue: status },
            severity: { DataType: 'String', StringValue: status === 'error' ? 'high' : 'info' }
        };

        return await this.publishMessage(subject, notification, attributes);
    }

    /**
     * Enviar notificación de tarea completada
     */
    async sendTaskCompletionNotification(taskId, result, executionTime = null) {
        const notification = {
            type: 'task_completion',
            taskId: taskId,
            result: result,
            executionTime: executionTime,
            timestamp: new Date().toISOString()
        };

        const subject = `[TASK] Completada: ${taskId}`;
        const attributes = {
            type: { DataType: 'String', StringValue: 'task_completion' },
            taskId: { DataType: 'String', StringValue: taskId },
            severity: { DataType: 'String', StringValue: 'info' }
        };

        return await this.publishMessage(subject, notification, attributes);
    }

    /**
     * Enviar notificación personalizada
     */
    async sendCustomNotification(type, subject, data, attributes = {}) {
        const notification = {
            type: 'custom',
            customType: type,
            data: data,
            timestamp: new Date().toISOString()
        };

        const messageAttributes = {
            type: { DataType: 'String', StringValue: 'custom' },
            customType: { DataType: 'String', StringValue: type },
            ...this.formatMessageAttributes(attributes)
        };

        return await this.publishMessage(subject, notification, messageAttributes);
    }

    /**
     * Formatear atributos de mensaje para SNS
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
            } else if (Array.isArray(value)) {
                formatted[key] = {
                    DataType: 'String.Array',
                    StringValue: JSON.stringify(value)
                };
            }
        }

        return formatted;
    }

    /**
     * Configurar el ARN del tópico
     */
    setTopicArn(topicArn) {
        this.topicArn = topicArn;
    }

    /**
     * Obtener el ARN del tópico actual
     */
    getTopicArn() {
        return this.topicArn;
    }
}
