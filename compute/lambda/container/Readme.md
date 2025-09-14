# Implementación de una Función Lambda en AWS usando Contenedores

Este documento describe los pasos necesarios para crear, configurar e implementar una función Lambda en AWS utilizando contenedores.

## Prerrequisitos

1. **AWS CLI**: Asegúrate de tener instalada y configurada la CLI de AWS.
2. **Docker**: Instala Docker para construir y manejar imágenes de contenedores.
3. **Credenciales de AWS**: Configura tus credenciales de AWS con permisos para ECR y Lambda.

---

## Pasos

### 1. Autenticación en Amazon ECR

Ejecuta el siguiente comando para autenticar Docker con el repositorio de imagenes de aws, ECR:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### 2. Crear un Repositorio en Amazon ECR

Crea un repositorio en Amazon ECR para almacenar tu imagen de contenedor:

```bash
aws ecr create-repository \
  --repository-name hello-world \
  --region us-east-1 \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability MUTABLE
```

### 2.1. Construir la Imagen de Docker

Construye la imagen de Docker utilizando el archivo `Dockerfile` en el directorio actual:

```bash
docker build -t docker-image:test .
```

### 3. Etiquetar la Imagen de Docker

Etiqueta tu imagen de Docker para que apunte al repositorio de ECR:

```bash
docker tag docker-image:test ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/hello-world:latest
```

### 4. Subir la Imagen al Repositorio de ECR

Sube la imagen etiquetada al repositorio de ECR:

```bash
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/hello-world:latest
```

### 5. Crear la Función Lambda

Crea una función Lambda utilizando la imagen de contenedor almacenada en ECR:

```bash
aws lambda create-function \
  --function-name hello-world \
  --package-type Image \
  --code ImageUri=ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/hello-world:latest \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-ex
```

### 6. Probar la Función Lambda

Invoca la función Lambda para probar su funcionamiento:

```bash
aws lambda invoke --function-name hello-world response.json
```

El resultado de la invocación se almacenará en el archivo `response.json`.

---

## Notas

- Reemplaza `ACCOUNT_ID` con tu ID de cuenta de AWS.
- Asegúrate de que el rol IAM asociado tenga los permisos necesarios para ejecutar funciones Lambda y acceder a ECR.