# Ejemplo de Gestión de Archivos con AWS S3

Este proyecto demuestra cómo interactuar con Amazon S3 (Simple Storage Service) utilizando Node.js y el AWS SDK v3. Es un ejemplo práctico de desarrollo de software en la nube que incluye operaciones básicas de almacenamiento.

## 🎯 Objetivo

El objetivo de este ejemplo es mostrar las operaciones fundamentales de AWS S3:

- **Subir archivos** al bucket de S3
- **Descargar archivos** desde S3
- **Listar archivos** existentes en el bucket
- **Configuración** del cliente S3 con credenciales

## 🏗️ Arquitectura del Proyecto

```
src/
├── index.js          # Menú principal interactivo
├── s3Client.js       # Configuración del cliente S3
├── upload.js         # Funcionalidad de subida de archivos
├── download.js       # Funcionalidad de descarga de archivos
└── list.js           # Funcionalidad de listado de archivos
```

## 🚀 Funcionalidades

### 1. **Menú Interactivo** (`index.js`)

- Interfaz de línea de comandos usando `inquirer`
- Opciones disponibles:
  - 📂 Listar archivos en el bucket
  - 📤 Subir archivo al bucket
  - 📥 Descargar archivo del bucket
  - ❌ Salir del programa

### 2. **Configuración S3** (`s3Client.js`)

- Configuración del cliente S3 usando AWS SDK v3
- Manejo de credenciales mediante variables de entorno
- Región configurable (por defecto: `us-east-1`)

### 3. **Subida de Archivos** (`upload.js`)

- Utiliza `PutObjectCommand` para subir archivos
- Stream de lectura para archivos grandes
- Manejo de errores y confirmación de éxito

### 4. **Descarga de Archivos** (`download.js`)

- Utiliza `GetObjectCommand` para descargar archivos
- Stream de escritura para archivos grandes
- Especificación de ruta de destino local

### 5. **Listado de Archivos** (`list.js`)

- Utiliza `ListObjectsV2Command` para listar objetos
- Muestra todos los archivos en el bucket
- Manejo de buckets vacíos

## 📋 Prerrequisitos

- Node.js (versión 14 o superior)
- Cuenta de AWS con acceso a S3
- Bucket de S3 creado
- Credenciales de AWS configuradas

## ⚙️ Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=nombre-de-tu-bucket
```

### 3. Ejecutar el programa

```bash
npm start
```

## 🔧 Dependencias

- **@aws-sdk/client-s3**: SDK oficial de AWS para S3
- **dotenv**: Manejo de variables de entorno
- **inquirer**: Interfaz interactiva de línea de comandos

## 📚 Conceptos de Desarrollo en la Nube

Este ejemplo ilustra varios conceptos importantes:

### **1. Almacenamiento en la Nube**

- S3 como servicio de almacenamiento de objetos
- Escalabilidad y disponibilidad automática
- Acceso programático a través de APIs

### **2. Gestión de Credenciales**

- Variables de entorno para configuración sensible
- Separación de configuración y código
- Buenas prácticas de seguridad

### **3. Programación Asíncrona**

- Uso de `async/await` para operaciones de red
- Manejo de promesas en operaciones S3
- Flujo de control asíncrono

### **4. Streams de Node.js**

- Lectura eficiente de archivos grandes
- Escritura de datos en tiempo real
- Optimización de memoria

### **5. Manejo de Errores**

- Try-catch para operaciones de red
- Mensajes de error descriptivos
- Recuperación graceful de fallos

## 🔍 Casos de Uso

- **Backup de archivos**: Subir copias de seguridad a la nube
- **Distribución de contenido**: Almacenar y servir archivos estáticos
- **Sincronización**: Mantener archivos sincronizados entre dispositivos
- **Análisis de datos**: Almacenar datasets para procesamiento

## 📖 Recursos Adicionales

- [Documentación oficial de AWS S3](https://docs.aws.amazon.com/s3/)
- [AWS SDK para JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [Node.js Streams](https://nodejs.org/api/stream.html)
- [Variables de entorno en Node.js](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)

---

_Este ejemplo forma parte de una colección de proyectos educativos para Desarrollo de software Cloud._
