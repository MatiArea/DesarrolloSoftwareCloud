import { DescribeDBInstancesCommand, RDSClient } from '@aws-sdk/client-rds';

import mysql from 'mysql2/promise';

const rdsClient = new RDSClient({ region: process.env.AWS_REGION });

/**
 * Servicio para operaciones con Amazon RDS
 */
export class RDSService {
    constructor() {
        this.connection = null;
        this.config = {
            host: process.env.RDS_ENDPOINT,
            port: process.env.RDS_PORT || 3306,
            user: process.env.RDS_USERNAME,
            password: process.env.RDS_PASSWORD,
            database: process.env.RDS_DATABASE_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            acquireTimeout: 60000,
            timeout: 60000
        };
    }

    /**
     * Establecer conexión con la base de datos
     */
    async connect() {
        try {
            if (!this.connection) {
                this.connection = await mysql.createConnection(this.config);
                console.log('Conexión a RDS establecida exitosamente');
            }
            return { success: true, message: 'Conexión establecida' };
        } catch (error) {
            console.error('Error conectando a RDS:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cerrar conexión con la base de datos
     */
    async disconnect() {
        try {
            if (this.connection) {
                await this.connection.end();
                this.connection = null;
                console.log('Conexión a RDS cerrada');
            }
            return { success: true, message: 'Conexión cerrada' };
        } catch (error) {
            console.error('Error cerrando conexión a RDS:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Ejecutar consulta SQL
     */
    async query(sql, params = []) {
        try {
            if (!this.connection) {
                await this.connect();
            }

            const [rows, fields] = await this.connection.execute(sql, params);

            return {
                success: true,
                rows: rows,
                fields: fields,
                rowCount: rows.length
            };
        } catch (error) {
            console.error('Error ejecutando consulta:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Inicializar esquema de base de datos
     */
    async initializeSchema() {
        try {
            const schemas = [
                // Tabla para metadatos de archivos
                `CREATE TABLE IF NOT EXISTS file_metadata (
                    id VARCHAR(255) PRIMARY KEY,
                    original_key VARCHAR(500) NOT NULL,
                    bucket VARCHAR(255) NOT NULL,
                    size BIGINT NOT NULL,
                    content_type VARCHAR(100),
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP NULL,
                    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                    data JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_uploaded_at (uploaded_at),
                    INDEX idx_content_type (content_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

                // Tabla para procesamiento de mensajes
                `CREATE TABLE IF NOT EXISTS message_processing (
                    id VARCHAR(255) PRIMARY KEY,
                    message_id VARCHAR(255) NOT NULL,
                    queue_name VARCHAR(255) NOT NULL,
                    status ENUM('received', 'processing', 'completed', 'failed') DEFAULT 'received',
                    data JSON,
                    error_message TEXT,
                    retry_count INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP NULL,
                    INDEX idx_status (status),
                    INDEX idx_message_id (message_id),
                    INDEX idx_queue_name (queue_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

                // Tabla para ejecuciones de Step Functions
                `CREATE TABLE IF NOT EXISTS step_function_executions (
                    id VARCHAR(255) PRIMARY KEY,
                    execution_arn VARCHAR(500) NOT NULL UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    status ENUM('RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED') DEFAULT 'RUNNING',
                    input JSON,
                    output JSON,
                    error_message TEXT,
                    started_at TIMESTAMP NOT NULL,
                    stopped_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_name (name),
                    INDEX idx_started_at (started_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

                // Tabla para notificaciones SNS
                `CREATE TABLE IF NOT EXISTS sns_notifications (
                    id VARCHAR(255) PRIMARY KEY,
                    topic_arn VARCHAR(500) NOT NULL,
                    subject VARCHAR(500),
                    message TEXT NOT NULL,
                    message_attributes JSON,
                    status ENUM('sent', 'delivered', 'failed') DEFAULT 'sent',
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    delivered_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_topic_arn (topic_arn),
                    INDEX idx_status (status),
                    INDEX idx_sent_at (sent_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

                // Tabla para estadísticas del sistema
                `CREATE TABLE IF NOT EXISTS system_statistics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    metric_name VARCHAR(255) NOT NULL,
                    metric_value DECIMAL(15,4) NOT NULL,
                    metric_unit VARCHAR(50),
                    tags JSON,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_metric_name (metric_name),
                    INDEX idx_timestamp (timestamp)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
            ];

            for (const schema of schemas) {
                await this.query(schema);
            }

            return {
                success: true,
                message: 'Esquema de base de datos inicializado exitosamente'
            };
        } catch (error) {
            console.error('Error inicializando esquema:', error);
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
        const sql = `
            INSERT INTO file_metadata 
            (id, original_key, bucket, size, content_type, uploaded_at, processed_at, status, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            original_key = VALUES(original_key),
            bucket = VALUES(bucket),
            size = VALUES(size),
            content_type = VALUES(content_type),
            processed_at = VALUES(processed_at),
            status = VALUES(status),
            data = VALUES(data),
            updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            fileData.id,
            fileData.originalKey,
            fileData.bucket,
            fileData.size,
            fileData.contentType,
            fileData.uploadedAt,
            fileData.processedAt,
            fileData.status || 'pending',
            JSON.stringify(fileData.data || {})
        ];

        return await this.query(sql, params);
    }

    /**
     * Obtener metadatos de archivo
     */
    async getFileMetadata(fileId) {
        const sql = 'SELECT * FROM file_metadata WHERE id = ?';
        return await this.query(sql, [fileId]);
    }

    /**
     * Actualizar estado de procesamiento de archivo
     */
    async updateFileProcessingStatus(fileId, status, details = {}) {
        const sql = `
            UPDATE file_metadata 
            SET status = ?, processed_at = ?, data = JSON_SET(COALESCE(data, '{}'), '$.processingDetails', ?)
            WHERE id = ?
        `;

        const params = [status, new Date(), JSON.stringify(details), fileId];
        return await this.query(sql, params);
    }

    /**
     * Guardar procesamiento de mensaje
     */
    async saveMessageProcessing(messageData) {
        const sql = `
            INSERT INTO message_processing 
            (id, message_id, queue_name, status, data)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            data = VALUES(data),
            updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            messageData.id,
            messageData.messageId,
            messageData.queueName,
            messageData.status || 'received',
            JSON.stringify(messageData.data || {})
        ];

        return await this.query(sql, params);
    }

    /**
     * Actualizar estado de procesamiento de mensaje
     */
    async updateMessageProcessingStatus(messageId, status, errorMessage = null) {
        const sql = `
            UPDATE message_processing 
            SET status = ?, error_message = ?, completed_at = ?
            WHERE message_id = ?
        `;

        const params = [status, errorMessage, new Date(), messageId];
        return await this.query(sql, params);
    }

    /**
     * Guardar ejecución de Step Function
     */
    async saveStepFunctionExecution(executionData) {
        const sql = `
            INSERT INTO step_function_executions 
            (id, execution_arn, name, status, input, output, error_message, started_at, stopped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            output = VALUES(output),
            error_message = VALUES(error_message),
            stopped_at = VALUES(stopped_at),
            updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            executionData.id,
            executionData.executionArn,
            executionData.name,
            executionData.status,
            JSON.stringify(executionData.input || {}),
            JSON.stringify(executionData.output || {}),
            executionData.errorMessage,
            executionData.startedAt,
            executionData.stoppedAt
        ];

        return await this.query(sql, params);
    }

    /**
     * Guardar notificación SNS
     */
    async saveSNSNotification(notificationData) {
        const sql = `
            INSERT INTO sns_notifications 
            (id, topic_arn, subject, message, message_attributes, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [
            notificationData.id,
            notificationData.topicArn,
            notificationData.subject,
            notificationData.message,
            JSON.stringify(notificationData.messageAttributes || {}),
            notificationData.status || 'sent'
        ];

        return await this.query(sql, params);
    }

    /**
     * Obtener estadísticas de archivos
     */
    async getFileStatistics() {
        const sql = `
            SELECT 
                COUNT(*) as total_files,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_files,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_files,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_files,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_files,
                SUM(size) as total_size,
                AVG(size) as average_size,
                content_type,
                COUNT(*) as count_by_type
            FROM file_metadata 
            GROUP BY content_type
        `;

        return await this.query(sql);
    }

    /**
     * Obtener estadísticas de procesamiento de mensajes
     */
    async getMessageProcessingStatistics() {
        const sql = `
            SELECT 
                COUNT(*) as total_messages,
                COUNT(CASE WHEN status = 'received' THEN 1 END) as received_messages,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_messages,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_messages,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_messages,
                AVG(retry_count) as average_retries,
                queue_name,
                COUNT(*) as count_by_queue
            FROM message_processing 
            GROUP BY queue_name
        `;

        return await this.query(sql);
    }

    /**
     * Obtener estadísticas de Step Functions
     */
    async getStepFunctionStatistics() {
        const sql = `
            SELECT 
                COUNT(*) as total_executions,
                COUNT(CASE WHEN status = 'RUNNING' THEN 1 END) as running_executions,
                COUNT(CASE WHEN status = 'SUCCEEDED' THEN 1 END) as succeeded_executions,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_executions,
                COUNT(CASE WHEN status = 'TIMED_OUT' THEN 1 END) as timed_out_executions,
                AVG(TIMESTAMPDIFF(SECOND, started_at, stopped_at)) as average_execution_time_seconds
            FROM step_function_executions
            WHERE stopped_at IS NOT NULL
        `;

        return await this.query(sql);
    }

    /**
     * Obtener estadísticas de notificaciones SNS
     */
    async getSNSNotificationStatistics() {
        const sql = `
            SELECT 
                COUNT(*) as total_notifications,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_notifications,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_notifications,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_notifications,
                topic_arn,
                COUNT(*) as count_by_topic
            FROM sns_notifications 
            GROUP BY topic_arn
        `;

        return await this.query(sql);
    }

    /**
     * Guardar métrica del sistema
     */
    async saveSystemMetric(metricName, metricValue, metricUnit = null, tags = {}) {
        const sql = `
            INSERT INTO system_statistics 
            (metric_name, metric_value, metric_unit, tags)
            VALUES (?, ?, ?, ?)
        `;

        const params = [metricName, metricValue, metricUnit, JSON.stringify(tags)];
        return await this.query(sql, params);
    }

    /**
     * Obtener métricas del sistema
     */
    async getSystemMetrics(metricName = null, timeRange = '24h') {
        let sql = 'SELECT * FROM system_statistics WHERE 1=1';
        const params = [];

        if (metricName) {
            sql += ' AND metric_name = ?';
            params.push(metricName);
        }

        // Agregar filtro de tiempo
        const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 24;
        sql += ' AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
        params.push(hours);

        sql += ' ORDER BY timestamp DESC';

        return await this.query(sql, params);
    }

    /**
     * Obtener información de la instancia RDS
     */
    async getRDSInstanceInfo() {
        try {
            const result = await rdsClient.send(new DescribeDBInstancesCommand({}));

            const instances = result.DBInstances?.map(instance => ({
                identifier: instance.DBInstanceIdentifier,
                status: instance.DBInstanceStatus,
                engine: instance.Engine,
                engineVersion: instance.EngineVersion,
                instanceClass: instance.DBInstanceClass,
                allocatedStorage: instance.AllocatedStorage,
                endpoint: instance.Endpoint?.Address,
                port: instance.Endpoint?.Port,
                availabilityZone: instance.AvailabilityZone,
                multiAZ: instance.MultiAZ,
                backupRetentionPeriod: instance.BackupRetentionPeriod,
                storageType: instance.StorageType
            })) || [];

            return {
                success: true,
                instances: instances
            };
        } catch (error) {
            console.error('Error obteniendo información de RDS:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Ejecutar transacción
     */
    async transaction(operations) {
        try {
            if (!this.connection) {
                await this.connect();
            }

            await this.connection.beginTransaction();

            const results = [];
            for (const operation of operations) {
                const result = await this.query(operation.sql, operation.params);
                results.push(result);

                if (!result.success) {
                    await this.connection.rollback();
                    return {
                        success: false,
                        error: `Error en operación: ${result.error}`,
                        results: results
                    };
                }
            }

            await this.connection.commit();

            return {
                success: true,
                message: 'Transacción completada exitosamente',
                results: results
            };
        } catch (error) {
            if (this.connection) {
                await this.connection.rollback();
            }
            console.error('Error en transacción:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
