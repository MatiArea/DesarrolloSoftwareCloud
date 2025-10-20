import { DescribeExecutionCommand, GetExecutionHistoryCommand, ListExecutionsCommand, SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const sfnClient = new SFNClient({ region: process.env.AWS_REGION });

/**
 * Servicio para operaciones con AWS Step Functions
 */
export class StepFunctionsService {
    constructor(stateMachineArn) {
        this.stateMachineArn = stateMachineArn;
    }

    /**
     * Iniciar ejecución de Step Function
     */
    async startExecution(name, input = {}, executionOptions = {}) {
        try {
            const params = {
                stateMachineArn: this.stateMachineArn,
                name: name,
                input: JSON.stringify(input),
                ...executionOptions
            };

            const result = await sfnClient.send(new StartExecutionCommand(params));

            return {
                success: true,
                executionArn: result.executionArn,
                startDate: result.startDate,
                message: 'Ejecución iniciada exitosamente'
            };
        } catch (error) {
            console.error('Error iniciando ejecución:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estado de una ejecución
     */
    async describeExecution(executionArn) {
        try {
            const params = {
                executionArn: executionArn
            };

            const result = await sfnClient.send(new DescribeExecutionCommand(params));

            return {
                success: true,
                execution: {
                    executionArn: result.executionArn,
                    stateMachineArn: result.stateMachineArn,
                    name: result.name,
                    status: result.status,
                    startDate: result.startDate,
                    stopDate: result.stopDate,
                    input: result.input,
                    output: result.output,
                    error: result.error,
                    cause: result.cause
                }
            };
        } catch (error) {
            console.error('Error describiendo ejecución:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Listar ejecuciones
     */
    async listExecutions(statusFilter = null, maxResults = 100) {
        try {
            const params = {
                stateMachineArn: this.stateMachineArn,
                maxResults: maxResults
            };

            if (statusFilter) {
                params.statusFilter = statusFilter;
            }

            const result = await sfnClient.send(new ListExecutionsCommand(params));

            const executions = result.executions?.map(exec => ({
                executionArn: exec.executionArn,
                name: exec.name,
                status: exec.status,
                startDate: exec.startDate,
                stopDate: exec.stopDate
            })) || [];

            return {
                success: true,
                executions: executions,
                nextToken: result.nextToken
            };
        } catch (error) {
            console.error('Error listando ejecuciones:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener historial de ejecución
     */
    async getExecutionHistory(executionArn, maxResults = 100) {
        try {
            const params = {
                executionArn: executionArn,
                maxResults: maxResults
            };

            const result = await sfnClient.send(new GetExecutionHistoryCommand(params));

            const events = result.events?.map(event => ({
                timestamp: event.timestamp,
                type: event.type,
                id: event.id,
                previousEventId: event.previousEventId,
                eventDetails: this.parseEventDetails(event)
            })) || [];

            return {
                success: true,
                events: events,
                nextToken: result.nextToken
            };
        } catch (error) {
            console.error('Error obteniendo historial de ejecución:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Esperar a que una ejecución termine
     */
    async waitForExecution(executionArn, pollInterval = 5000, maxWaitTime = 300000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const result = await this.describeExecution(executionArn);

            if (!result.success) {
                return result;
            }

            const status = result.execution.status;

            if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'TIMED_OUT' || status === 'ABORTED') {
                return result;
            }

            // Esperar antes de la siguiente verificación
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        return {
            success: false,
            error: 'Timeout esperando ejecución'
        };
    }

    /**
     * Iniciar workflow de procesamiento de archivo
     */
    async startFileProcessingWorkflow(fileInfo, options = {}) {
        const workflowInput = {
            fileInfo: fileInfo,
            options: {
                processImages: options.processImages || false,
                extractText: options.extractText || false,
                generateThumbnails: options.generateThumbnails || false,
                ...options
            },
            metadata: {
                startedAt: new Date().toISOString(),
                workflowType: 'file_processing'
            }
        };

        const executionName = `file-processing-${fileInfo.id || Date.now()}`;
        return await this.startExecution(executionName, workflowInput);
    }

    /**
     * Iniciar workflow de sincronización de datos
     */
    async startDataSyncWorkflow(source, destination, options = {}) {
        const workflowInput = {
            source: source,
            destination: destination,
            options: {
                batchSize: options.batchSize || 100,
                retryAttempts: options.retryAttempts || 3,
                ...options
            },
            metadata: {
                startedAt: new Date().toISOString(),
                workflowType: 'data_sync'
            }
        };

        const executionName = `data-sync-${Date.now()}`;
        return await this.startExecution(executionName, workflowInput);
    }

    /**
     * Iniciar workflow de análisis de datos
     */
    async startDataAnalysisWorkflow(dataSource, analysisType, options = {}) {
        const workflowInput = {
            dataSource: dataSource,
            analysisType: analysisType,
            options: {
                includeStatistics: options.includeStatistics || true,
                generateReport: options.generateReport || false,
                ...options
            },
            metadata: {
                startedAt: new Date().toISOString(),
                workflowType: 'data_analysis'
            }
        };

        const executionName = `data-analysis-${Date.now()}`;
        return await this.startExecution(executionName, workflowInput);
    }

    /**
     * Monitorear ejecuciones activas
     */
    async monitorActiveExecutions(callback) {
        try {
            const result = await this.listExecutions('RUNNING');

            if (!result.success) {
                return result;
            }

            for (const execution of result.executions) {
                const details = await this.describeExecution(execution.executionArn);
                if (details.success && callback) {
                    await callback(details.execution);
                }
            }

            return {
                success: true,
                monitoredExecutions: result.executions.length
            };
        } catch (error) {
            console.error('Error monitoreando ejecuciones:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtener estadísticas de ejecuciones
     */
    async getExecutionStatistics(timeRange = '24h') {
        try {
            const now = new Date();
            let startDate;

            switch (timeRange) {
                case '1h':
                    startDate = new Date(now.getTime() - 60 * 60 * 1000);
                    break;
                case '24h':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            }

            // Obtener todas las ejecuciones
            const result = await this.listExecutions();

            if (!result.success) {
                return result;
            }

            // Filtrar por rango de tiempo y calcular estadísticas
            const filteredExecutions = result.executions.filter(exec =>
                new Date(exec.startDate) >= startDate
            );

            const stats = {
                total: filteredExecutions.length,
                succeeded: filteredExecutions.filter(e => e.status === 'SUCCEEDED').length,
                failed: filteredExecutions.filter(e => e.status === 'FAILED').length,
                running: filteredExecutions.filter(e => e.status === 'RUNNING').length,
                timedOut: filteredExecutions.filter(e => e.status === 'TIMED_OUT').length,
                aborted: filteredExecutions.filter(e => e.status === 'ABORTED').length,
                successRate: 0,
                averageExecutionTime: 0,
                timeRange: timeRange,
                startDate: startDate,
                endDate: now
            };

            // Calcular tasa de éxito
            if (stats.total > 0) {
                stats.successRate = (stats.succeeded / stats.total) * 100;
            }

            // Calcular tiempo promedio de ejecución
            const completedExecutions = filteredExecutions.filter(e =>
                e.status === 'SUCCEEDED' && e.stopDate
            );

            if (completedExecutions.length > 0) {
                const totalTime = completedExecutions.reduce((sum, exec) => {
                    const duration = new Date(exec.stopDate) - new Date(exec.startDate);
                    return sum + duration;
                }, 0);

                stats.averageExecutionTime = totalTime / completedExecutions.length;
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
     * Parsear detalles de eventos
     */
    parseEventDetails(event) {
        const details = {
            timestamp: event.timestamp,
            type: event.type
        };

        // Extraer detalles específicos según el tipo de evento
        switch (event.type) {
            case 'ExecutionStarted':
                details.executionInput = event.executionStartedEventDetails?.input;
                break;
            case 'ExecutionSucceeded':
                details.output = event.executionSucceededEventDetails?.output;
                break;
            case 'ExecutionFailed':
                details.error = event.executionFailedEventDetails?.error;
                details.cause = event.executionFailedEventDetails?.cause;
                break;
            case 'TaskStarted':
                details.resource = event.taskStartedEventDetails?.resource;
                break;
            case 'TaskSucceeded':
                details.output = event.taskSucceededEventDetails?.output;
                break;
            case 'TaskFailed':
                details.error = event.taskFailedEventDetails?.error;
                details.cause = event.taskFailedEventDetails?.cause;
                break;
        }

        return details;
    }

    /**
     * Configurar el ARN de la máquina de estados
     */
    setStateMachineArn(stateMachineArn) {
        this.stateMachineArn = stateMachineArn;
    }

    /**
     * Obtener el ARN de la máquina de estados actual
     */
    getStateMachineArn() {
        return this.stateMachineArn;
    }
}
