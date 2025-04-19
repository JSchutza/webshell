FROM alpine:latest

# Update and install basic packages
RUN apk update && apk add --no-cache \
    bash \
    coreutils \
    curl \
    tree \
    vim \
    nano

# Create a non-root user
RUN adduser -D -h /home/webuser webuser

# Set up the working directory
WORKDIR /home/webuser

# Create some sample files for demonstration
RUN mkdir -p /home/webuser/docs /home/webuser/projects
RUN echo "Hello from WebTerminal!" > /home/webuser/welcome.txt
RUN echo "This is a sample file." > /home/webuser/docs/sample.txt
RUN echo "Another sample file for testing." > /home/webuser/projects/test.txt

# Set proper ownership
RUN chown -R webuser:webuser /home/webuser

# Switch to non-root user
USER webuser

# Keep the container running
CMD ["tail", "-f", "/dev/null"] 