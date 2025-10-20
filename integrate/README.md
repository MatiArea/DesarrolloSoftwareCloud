# AWS Services Integration

Este proyecto demuestra la integración completa de múltiples servicios de Amazon Web Services (AWS) utilizando JavaScript. La aplicación muestra cómo los diferentes servicios pueden trabajar juntos para crear un flujo de procesamiento de datos robusto y escalable.

## 🏗️ Arquitectura

El proyecto integra los siguientes servicios AWS:

- **S3** - Almacenamiento de archivos
- **Lambda** - Procesamiento serverless
- **SQS** - Colas de mensajes
- **Step Functions** - Orquestación de workflows
- **SNS** - Notificaciones
- **DynamoDB** - Base de datos NoSQL
- **RDS** - Base de datos relacional

## 📁 Estructura del Proyecto

```
integrate/
├── src/
│   ├── lambda/                 # Funciones Lambda
│   │   ├── processFile.js      # Procesamiento de archivos S3
│   │   └── processSQSMessage.js # Procesamiento de mensajes SQS
│   ├── services/               # Servicios AWS
│   │   ├── s3Service.js        # Cliente S3
│   │   ├── sqsService.js       # Cliente SQS
│   │   ├── snsService.js       # Cliente SNS
│   │   ├── stepFunctionsService.js # Cliente Step Functions
│   │   ├── dynamoService.js    # Cliente DynamoDB
│   │   └── rdsService.js       # Cliente RDS
│   └── index.js                # Aplicación principal
├── package.json                # Dependencias
├── env.example                 # Variables de entorno
└── README.md                   # Documentación
```

## 🚀 Instalación

1. **Clonar el repositorio**:

```bash
git clone <repository-url>
cd integrate
```

2. **Instalar dependencias**:

```bash
npm install
```

3. **Configurar variables de entorno**:

```bash
cp env.example .env
```

Editar el archivo `.env` con tus credenciales y configuración AWS:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# S3 Configuration
S3_BUCKET_NAME=aws-integration-bucket

# SQS Configuration
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/integration-queue

# SNS Configuration
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:integration-topic

# Step Functions Configuration
STEP_FUNCTION_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:IntegrationWorkflow

# DynamoDB Configuration
DYNAMODB_TABLE_NAME=integration-table

# RDS Configuration
RDS_ENDPOINT=integration-db.cluster-xyz.us-east-1.rds.amazonaws.com
RDS_PORT=3306
RDS_DATABASE_NAME=integration_db
RDS_USERNAME=admin
RDS_PASSWORD=your_password_here
```

## 📋 Prerrequisitos

### Servicios AWS Requeridos

Antes de ejecutar la aplicación, asegúrate de tener los siguientes recursos creados en AWS:

#### 1. S3 Bucket

```bash
aws s3 mb s3://aws-integration-bucket
```

#### 2. DynamoDB Table

```bash
aws dynamodb create-table \
    --table-name integration-table \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST
```

#### 3. SQS Queue

```bash
aws sqs create-queue \
    --queue-name integration-queue \
    --attributes VisibilityTimeoutSeconds=300
```

#### 4. SNS Topic

```bash
aws sns create-topic --name integration-topic
```

#### 5. RDS Instance

```bash
aws rds create-db-instance \
    --db-instance-identifier integration-db \
    --db-instance-class db.t3.micro \
    --engine mysql \
    --master-username admin \
    --master-user-password your_password_here \
    --allocated-storage 20
```

#### 6. Step Functions State Machine

Crear una state machine con el siguiente JSON:

```json
{
	"Comment": "File Processing Workflow",
	"StartAt": "ProcessFile",
	"States": {
		"ProcessFile": {
			"Type": "Task",
			"Resource": "arn:aws:lambda:us-east-1:123456789012:function:processFile",
			"Next": "SendNotification",
			"Catch": [
				{
					"ErrorEquals": ["States.ALL"],
					"Next": "HandleError",
					"ResultPath": "$.error"
				}
			]
		},
		"SendNotification": {
			"Type": "Task",
			"Resource": "arn:aws:lambda:us-east-1:123456789012:function:sendNotification",
			"End": true
		},
		"HandleError": {
			"Type": "Task",
			"Resource": "arn:aws:lambda:us-east-1:123456789012:function:handleError",
			"End": true
		}
	}
}
```

## 🎯 Uso

### Ejecutar la Aplicación Completa

```bash
npm start
```

### Ejecutar Ejemplo de Integración

```bash
node src/index.js
```

## 🔄 Flujo de Trabajo

### 1. Procesamiento de Archivos

```javascript
import { AWSIntegrationApp } from './src/index.js'

const app = new AWSIntegrationApp()
await app.initialize()

// Procesar archivo
const result = await app.processFileComplete(
	'mi-archivo.json',
	JSON.stringify({ data: 'ejemplo' }),
	'application/json',
)
```

### 2. Procesamiento de Mensajes SQS

```javascript
// El servicio SQS procesa automáticamente los mensajes
const sqsService = new SQSService(process.env.SQS_QUEUE_URL)

// Enviar mensaje
await sqsService.sendMessage({
	type: 'file_processing',
	data: { fileId: '123' },
})

// Procesar mensajes
await sqsService.processMessages(async (message) => {
	console.log('Procesando:', message.body)
	// Lógica de procesamiento
})
```

### 3. Notificaciones SNS

```javascript
const snsService = new SNSService(process.env.SNS_TOPIC_ARN)

// Enviar notificación
await snsService.sendFileProcessingNotification(
	{ id: '123', name: 'archivo.txt' },
	'completed',
	{ size: 1024 },
)
```

### 4. Step Functions

```javascript
const stepFunctions = new StepFunctionsService(process.env.STEP_FUNCTION_ARN)

// Iniciar workflow
const execution = await stepFunctions.startFileProcessingWorkflow({
	id: '123',
	name: 'archivo.txt',
})

// Monitorear ejecución
const result = await stepFunctions.waitForExecution(execution.executionArn)
```

## 📊 Monitoreo y Estadísticas

### Obtener Estadísticas del Sistema

```javascript
const stats = await app.getSystemStatistics()
console.log(stats.statistics)
```

### Estadísticas Disponibles

- **Archivos**: Total, por estado, por tipo de contenido
- **Mensajes**: Total procesados, exitosos, fallidos
- **Step Functions**: Ejecuciones, tiempo promedio, tasa de éxito
- **SQS**: Mensajes en cola, procesados, retrasados
- **S3**: Total de archivos, tamaños

## 🛠️ Servicios Individuales

### S3Service

```javascript
import { S3Service } from './src/services/s3Service.js'

const s3 = new S3Service('mi-bucket')

// Subir archivo
const result = await s3.uploadFile('archivo.txt', 'contenido', 'text/plain')

// Descargar archivo
const file = await s3.downloadFile('archivo.txt')

// Listar archivos
const files = await s3.listFiles('uploads/')
```

### DynamoService

```javascript
import { DynamoService } from './src/services/dynamoService.js'

const dynamo = new DynamoService('mi-tabla')

// Guardar item
await dynamo.putItem({
	id: '123',
	data: { ejemplo: 'valor' },
})

// Obtener item
const item = await dynamo.getItem({ id: '123' })

// Consultar items
const items = await dynamo.queryItems('id = :id', { ':id': '123' })
```

### RDSService

```javascript
import { RDSService } from './src/services/rdsService.js'

const rds = new RDSService()
await rds.connect()

// Ejecutar consulta
const result = await rds.query('SELECT * FROM file_metadata WHERE id = ?', [
	'123',
])

// Transacción
await rds.transaction([
	{ sql: 'INSERT INTO table1 VALUES (?)', params: ['value1'] },
	{ sql: 'INSERT INTO table2 VALUES (?)', params: ['value2'] },
])
```

## 🔧 Configuración Avanzada

### Variables de Entorno Adicionales

```env
# Configuración de conexión
RDS_CONNECTION_LIMIT=10
RDS_TIMEOUT=60000

# Configuración de SQS
SQS_VISIBILITY_TIMEOUT=300
SQS_WAIT_TIME=20

# Configuración de Step Functions
STEP_FUNCTION_TIMEOUT=300000
STEP_FUNCTION_POLL_INTERVAL=5000
```

### Personalización de Servicios

Cada servicio puede ser personalizado extendiendo la clase base:

```javascript
class CustomS3Service extends S3Service {
	async uploadFileWithCompression(fileName, content) {
		// Lógica personalizada de compresión
		const compressed = await this.compress(content)
		return await this.uploadFile(fileName, compressed)
	}
}
```

## 🐛 Solución de Problemas

### Errores Comunes

1. **Error de credenciales AWS**

   ```
   Error: The security token included in the request is invalid
   ```

   Solución: Verificar que las credenciales en `.env` sean correctas.

2. **Error de conexión RDS**

   ```
   Error: connect ECONNREFUSED
   ```

   Solución: Verificar que la instancia RDS esté ejecutándose y el endpoint sea correcto.

3. **Error de permisos S3**
   ```
   Error: Access Denied
   ```
   Solución: Verificar que el bucket existe y los permisos IAM sean correctos.

### Logs y Debugging

```javascript
// Habilitar logs detallados
process.env.AWS_LOG_LEVEL = 'debug'

// Logs personalizados
console.log('Debug info:', {
	region: process.env.AWS_REGION,
	bucket: process.env.S3_BUCKET_NAME,
})
```

## 📈 Escalabilidad

### Mejores Prácticas

1. **Conexiones de Base de Datos**: Usar connection pooling para RDS
2. **Procesamiento Asíncrono**: Utilizar SQS para tareas pesadas
3. **Caché**: Implementar Redis para datos frecuentemente accedidos
4. **Monitoreo**: Configurar CloudWatch para métricas

### Optimizaciones

```javascript
// Procesamiento en lote
await sqsService.sendBatchMessages([{ body: 'mensaje1' }, { body: 'mensaje2' }])

// Consultas optimizadas
const items = await dynamoService.queryItems(
	'status = :status AND createdAt > :date',
	{ ':status': 'active', ':date': '2024-01-01' },
)
```

## 🔒 Seguridad

### Buenas Prácticas

1. **Credenciales**: Usar IAM roles en lugar de claves de acceso
2. **Encriptación**: Habilitar encriptación en S3 y RDS
3. **VPC**: Colocar RDS en una VPC privada
4. **Permisos**: Principio de menor privilegio para IAM

### Configuración Segura

```javascript
// Usar roles IAM en lugar de credenciales
const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	// No incluir credenciales explícitas
})
```

## 📚 Recursos Adicionales

- [Documentación AWS SDK v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [Amazon S3 User Guide](https://docs.aws.amazon.com/s3/)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request
