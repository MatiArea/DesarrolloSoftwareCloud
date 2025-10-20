import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Cliente de SQS
const client = new SQSClient({ region: "us-east-1" });

const params = {
    QueueUrl: "https://sqs.us-east-1.amazonaws.com/123456789012/cloud2025",
    MessageBody: JSON.stringify({ pedidoId: 101, producto: "Notebook", cantidad: 1 }),
};

const sendMessage = async () => {
    try {
        const result = await client.send(new SendMessageCommand(params));
        console.log("Mensaje enviado con ID:", result.MessageId);
    } catch (error) {
        console.error("Error enviando mensaje:", error);
    }
};

sendMessage();
