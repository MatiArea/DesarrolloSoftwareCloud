# 📊 Diagrama de Flujo - Integración AWS

## 🔄 Flujo Principal

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ 1. Sube archivo
       ▼
┌─────────────┐
│     S3      │ ◄── Almacena archivo
└──────┬──────┘
       │ 2. Genera evento
       ▼
┌─────────────┐
│   Lambda    │ ◄── Procesa archivo
└──────┬──────┘
       │ 3. Guarda metadatos
       ▼
┌─────────────┐
│  DynamoDB   │ ◄── Base de datos rápida
└──────┬──────┘
       │ 4. Sincroniza
       ▼
┌─────────────┐
│     RDS     │ ◄── Base de datos SQL
└──────┬──────┘
       │ 5. Envía mensaje
       ▼
┌─────────────┐
│     SQS     │ ◄── Cola de mensajes
└──────┬──────┘
       │ 6. Envía notificación
       ▼
┌─────────────┐
│     SNS     │ ◄── Notificaciones
└──────┬──────┘
       │ 7. Orquesta todo
       ▼
┌─────────────┐
│Step Functions│ ◄── Coordinador
└─────────────┘
```

## 🎯 Flujo Detallado por Pasos

### **Paso 1: Subida de Archivo**

```
Usuario → S3 Bucket
├── Archivo: documento.pdf
├── Tamaño: 2MB
└── Tipo: application/pdf
```

### **Paso 2: Activación de Lambda**

```
S3 Event → Lambda Function
├── Evento: s3:ObjectCreated
├── Función: processFile
└── Input: {bucket, key, size}
```

### **Paso 3: Procesamiento**

```
Lambda → Procesamiento
├── Lee archivo de S3
├── Extrae metadatos
├── Analiza contenido
└── Genera resultado
```

### **Paso 4: Almacenamiento de Metadatos**

```
Lambda → DynamoDB
├── ID: file_123
├── Tamaño: 2MB
├── Tipo: PDF
└── Estado: procesado
```

### **Paso 5: Sincronización con RDS**

```
Lambda → RDS
├── INSERT INTO file_metadata
├── VALUES (id, size, type, status)
└── Sincronización completa
```

### **Paso 6: Mensaje a Cola**

```
Lambda → SQS
├── Mensaje: {type: "file_processed", id: "123"}
├── Cola: integration-queue
└── Para procesamiento posterior
```

### **Paso 7: Notificación**

```
Lambda → SNS
├── Tópico: integration-topic
├── Mensaje: "Archivo procesado exitosamente"
└── Email/SMS al usuario
```

### **Paso 8: Orquestación**

```
Step Functions → Coordinación
├── Ejecuta pasos en orden
├── Maneja errores
└── Garantiza completitud
```

## 🔧 Arquitectura de Servicios

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                    │
├─────────────────────────────────────────────────────────────┤
│  Usuario Web  │  Aplicación Móvil  │  API REST            │
└─────────────────┬───────────────────┬───────────────────────┘
                  │                   │
┌─────────────────▼───────────────────▼───────────────────────┐
│                    CAPA DE SERVICIOS AWS                   │
├─────────────────────────────────────────────────────────────┤
│  S3 Storage    │  Lambda Functions  │  Step Functions      │
├─────────────────────────────────────────────────────────────┤
│  SQS Queues    │  SNS Notifications │  DynamoDB NoSQL      │
├─────────────────────────────────────────────────────────────┤
│  RDS MySQL     │  CloudWatch Logs   │  IAM Security        │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Flujo de Datos

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Archivo   │───▶│  Metadatos  │───▶│  Procesado  │
│   Original  │    │  (DynamoDB) │    │   (S3)      │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Evento S3  │    │ Sincronización│    │ Notificación│
│   (Lambda)  │    │    (RDS)     │    │   (SNS)    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Mensaje SQS │    │   Estadísticas│    │  Monitoreo  │
│ (Procesamiento│    │  (RDS)     │    │(CloudWatch) │
│   Asíncrono)│    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## ⚡ Escalabilidad del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    ESCALABILIDAD HORIZONTAL                │
├─────────────────────────────────────────────────────────────┤
│  Usuario 1  │  Usuario 2  │  Usuario 3  │  Usuario N      │
│     │       │     │       │     │       │     │            │
│     ▼       │     ▼       │     ▼       │     ▼            │
│  ┌─────┐    │  ┌─────┐    │  ┌─────┐    │  ┌─────┐         │
│  │ S3  │    │  │ S3  │    │  │ S3  │    │  │ S3  │         │
│  └─────┘    │  └─────┘    │  └─────┘    │  └─────┘         │
│     │       │     │       │     │       │     │            │
│     ▼       │     ▼       │     ▼       │     ▼            │
│  ┌─────┐    │  ┌─────┐    │  ┌─────┐    │  ┌─────┐         │
│  │Lambda│   │  │Lambda│   │  │Lambda│   │  │Lambda│        │
│  └─────┘    │  └─────┘    │  └─────┘    │  └─────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 🛡️ Manejo de Errores

```
┌─────────────┐
│   Error     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Retry SQS  │ ◄── Reintenta automáticamente
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Notificación│ ◄── Avisa sobre el error
│   Error SNS  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Logs       │ ◄── Registra para análisis
│CloudWatch   │
└─────────────┘
```

## 💰 Modelo de Costos

```
┌─────────────────────────────────────────────────────────────┐
│                    COSTOS POR USO                          │
├─────────────────────────────────────────────────────────────┤
│  S3:          $0.023 por GB/mes                            │
│  Lambda:      $0.0000166667 por GB-segundo                 │
│  DynamoDB:    $0.25 por GB/mes                             │
│  SQS:         $0.40 por millón de requests                 │
│  SNS:         $0.50 por millón de requests                 │
│  Step Functions: $0.000025 por transición                  │
│  RDS:         $0.017 por hora (db.t3.micro)                │
└─────────────────────────────────────────────────────────────┘
```
