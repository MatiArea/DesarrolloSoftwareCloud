docker build -t docker-image:test .

docker run -p 9000:8080 docker-image:test

# Test the function calling the endpoint:
curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{}'

# Test the function with a payload:
curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"payload":"hello world!"}'