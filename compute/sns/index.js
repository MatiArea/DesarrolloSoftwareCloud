import AWS from "aws-sdk";

const sns = new AWS.SNS({ region: "us-east-1" });

const params = {
    Message: "Nuevo pedido recibido!",
    TopicArn: "arn:aws:sns:us-east-1:123456789012:PedidosTopic",
};

sns.publish(params, (err, data) => {
    if (err) console.error(err);
    else console.log("Mensaje publicado:", data.MessageId);
});
