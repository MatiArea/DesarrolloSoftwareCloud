import { AWSIntegrationApp } from '../index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Ejemplos básicos de uso de la integración AWS
 */

// Ejemplo 1: Procesamiento básico de archivo
async function example1_BasicFileProcessing() {
    console.log('📁 Ejemplo 1: Procesamiento básico de archivo');
    console.log('='.repeat(50));

    const app = new AWSIntegrationApp();

    try {
        // Inicializar la aplicación
        await app.initialize();

        // Crear un archivo de ejemplo
        const fileData = {
            id: uuidv4(),
            message: 'Hola desde AWS Integration!',
            timestamp: new Date().toISOString(),
            data: {
                user: 'ejemplo',
                action: 'upload',
                metadata: {
                    source: 'web',
                    version: '1.0.0'
                }
            }
        };

        const fileName = `example_${Date.now()}.json`;
        const fileContent = JSON.stringify(fileData, null, 2);

        // Procesar el archivo
        const result = await app.processFileComplete(
            fileName,
            fileContent,
            'application/json'
        );

        if (result.success) {
            console.log('✅ Archivo procesado exitosamente:');
            console.log(`   - ID: ${result.fileId}`);
            console.log(`   - S3 Key: ${result.s3Key}`);
            console.log(`   - SQS Message ID: ${result.sqsMessageId}`);
        } else {
            console.error('❌ Error:', result.error);
        }

    } catch (error) {
        console.error('❌ Error en el ejemplo:', error);
    } finally {
        await app.cleanup();
    }
}

// Ejemplo 2: Procesamiento de múltiples archivos
async function example2_MultipleFiles() {
    console.log('\n📁 Ejemplo 2: Procesamiento de múltiples archivos');
    console.log('='.repeat(50));

    const app = new AWSIntegrationApp();

    try {
        await app.initialize();

        const files = [
            {
                name: 'config.json',
                content: JSON.stringify({
                    database: { host: 'localhost', port: 3306 },
                    api: { version: 'v1', timeout: 5000 }
                }),
                type: 'application/json'
            },
            {
                name: 'log.txt',
                content: '2024-01-01 10:00:00 - INFO - Application started\n2024-01-01 10:01:00 - INFO - Database connected',
                type: 'text/plain'
            },
            {
                name: 'data.csv',
                content: 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles\nBob,35,Chicago',
                type: 'text/csv'
            }
        ];

        const results = [];

        for (const file of files) {
            console.log(`   Procesando: ${file.name}`);

            const result = await app.processFileComplete(
                file.name,
                file.content,
                file.type
            );

            results.push({
                fileName: file.name,
                success: result.success,
                fileId: result.success ? result.fileId : null,
                error: result.success ? null : result.error
            });
        }

        console.log('\n📊 Resultados:');
        results.forEach(result => {
            if (result.success) {
                console.log(`   ✅ ${result.fileName} - ID: ${result.fileId}`);
            } else {
                console.log(`   ❌ ${result.fileName} - Error: ${result.error}`);
            }
        });

    } catch (error) {
        console.error('❌ Error en el ejemplo:', error);
    } finally {
        await app.cleanup();
    }
}

// Ejemplo 3: Monitoreo y estadísticas
async function example3_Monitoring() {
    console.log('\n📊 Ejemplo 3: Monitoreo y estadísticas');
    console.log('='.repeat(50));

    const app = new AWSIntegrationApp();

    try {
        await app.initialize();

        // Obtener estadísticas del sistema
        const stats = await app.getSystemStatistics();

        if (stats.success) {
            console.log('📈 Estadísticas del sistema:');

            if (stats.statistics.files) {
                console.log('\n📁 Estadísticas de archivos:');
                stats.statistics.files.forEach(row => {
                    console.log(`   - ${row.content_type || 'unknown'}: ${row.count_by_type} archivos`);
                });
            }

            if (stats.statistics.sqs) {
                console.log('\n📨 Estadísticas de SQS:');
                console.log(`   - Mensajes disponibles: ${stats.statistics.sqs.messagesAvailable}`);
                console.log(`   - Mensajes en procesamiento: ${stats.statistics.sqs.messagesInFlight}`);
                console.log(`   - Total: ${stats.statistics.sqs.totalMessages}`);
            }

            if (stats.statistics.stepFunctions) {
                console.log('\n⚡ Estadísticas de Step Functions:');
                console.log(`   - Total ejecuciones: ${stats.statistics.stepFunctions.total}`);
                console.log(`   - Exitosas: ${stats.statistics.stepFunctions.succeeded}`);
                console.log(`   - Fallidas: ${stats.statistics.stepFunctions.failed}`);
                console.log(`   - Tasa de éxito: ${stats.statistics.stepFunctions.successRate.toFixed(1)}%`);
            }

        } else {
            console.error('❌ Error obteniendo estadísticas:', stats.error);
        }

    } catch (error) {
        console.error('❌ Error en el ejemplo:', error);
    } finally {
        await app.cleanup();
    }
}

// Ejemplo 4: Manejo de errores
async function example4_ErrorHandling() {
    console.log('\n⚠️ Ejemplo 4: Manejo de errores');
    console.log('='.repeat(50));

    const app = new AWSIntegrationApp();

    try {
        await app.initialize();

        // Probar con datos inválidos
        console.log('   Probando con archivo vacío...');
        const emptyResult = await app.processFileComplete('', '', '');
        console.log(`   Resultado: ${emptyResult.success ? 'Éxito' : 'Error esperado'}`);

        // Probar con contenido muy grande
        console.log('   Probando con contenido grande...');
        const largeContent = 'x'.repeat(1000000); // 1MB
        const largeResult = await app.processFileComplete('large.txt', largeContent, 'text/plain');
        console.log(`   Resultado: ${largeResult.success ? 'Éxito' : 'Error'}`);

        // Probar con tipo de archivo no soportado
        console.log('   Probando con tipo no soportado...');
        const unsupportedResult = await app.processFileComplete('test.exe', 'binary data', 'application/octet-stream');
        console.log(`   Resultado: ${unsupportedResult.success ? 'Éxito' : 'Error esperado'}`);

    } catch (error) {
        console.error('❌ Error en el ejemplo:', error);
    } finally {
        await app.cleanup();
    }
}

// Ejemplo 5: Flujo completo de integración
async function example5_CompleteFlow() {
    console.log('\n🔄 Ejemplo 5: Flujo completo de integración');
    console.log('='.repeat(50));

    const app = new AWSIntegrationApp();

    try {
        // Ejecutar el flujo completo
        const result = await app.runExampleFlow();

        if (result.success) {
            console.log('🎉 Flujo completo ejecutado exitosamente!');
            console.log('\n📋 Resumen del flujo:');
            console.log(`   - Archivo ID: ${result.summary.fileId}`);
            console.log(`   - S3 Key: ${result.summary.s3Key}`);
            console.log(`   - SQS Message ID: ${result.summary.sqsMessageId}`);
            console.log(`   - Step Function: ${result.summary.stepFunctionExecution}`);
            console.log(`   - Procesado en: ${result.summary.processedAt}`);

            console.log('\n🔗 Servicios involucrados:');
            console.log('   ✅ S3 - Almacenamiento');
            console.log('   ✅ DynamoDB - Metadatos');
            console.log('   ✅ RDS - Sincronización');
            console.log('   ✅ SQS - Cola de mensajes');
            console.log('   ✅ SNS - Notificaciones');
            console.log('   ✅ Step Functions - Orquestación');
        } else {
            console.error('❌ Error en el flujo:', result.error);
        }

    } catch (error) {
        console.error('❌ Error en el ejemplo:', error);
    }
}

// Ejecutar todos los ejemplos
async function runAllExamples() {
    console.log('🚀 EJEMPLOS DE INTEGRACIÓN AWS');
    console.log('='.repeat(60));

    const examples = [
        { name: 'Procesamiento básico de archivo', fn: example1_BasicFileProcessing },
        { name: 'Múltiples archivos', fn: example2_MultipleFiles },
        { name: 'Monitoreo y estadísticas', fn: example3_Monitoring },
        { name: 'Manejo de errores', fn: example4_ErrorHandling },
        { name: 'Flujo completo', fn: example5_CompleteFlow }
    ];

    for (const example of examples) {
        try {
            await example.fn();
            console.log(`\n✅ Ejemplo "${example.name}" completado`);
        } catch (error) {
            console.error(`\n❌ Error en ejemplo "${example.name}":`, error);
        }

        // Pausa entre ejemplos
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎯 TODOS LOS EJEMPLOS COMPLETADOS');
    console.log('='.repeat(60));
}

// Ejecutar si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllExamples().catch(console.error);
}

export {
    example1_BasicFileProcessing,
    example2_MultipleFiles,
    example3_Monitoring,
    example4_ErrorHandling,
    example5_CompleteFlow,
    runAllExamples
};
