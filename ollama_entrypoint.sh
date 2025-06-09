#!/bin/bash
   set -ex

   # Create log directory
   mkdir -p /root/.ollama/logs
   touch /root/.ollama/logs/server.log

   # Log system resources
   echo "=== SYSTEM RESOURCES ===" | tee -a /root/.ollama/logs/server.log
   free -m | tee -a /root/.ollama/logs/server.log
   df -h | tee -a /root/.ollama/logs/server.log

   # Start server
   echo "Starting Ollama server..." | tee -a /root/.ollama/logs/server.log
   ollama serve >> /root/.ollama/logs/server.log 2>&1 &
   SERVER_PID=$!

   # Wait function with timeout
   wait_for_server() {
       local timeout=60
       local interval=5
       local elapsed=0
       
       while [ $elapsed -lt $timeout ]; do
           if curl -sSf http://localhost:11434/api/tags >/dev/null 2>&1; then
               echo "Ollama server is up!" | tee -a /root/.ollama/logs/server.log
               return 0
           fi
           sleep $interval
           elapsed=$((elapsed + interval))
           echo "Waiting for Ollama server... ($elapsed/$timeout seconds)" | tee -a /root/.ollama/logs/server.log
       done
       
       echo "Timeout waiting for Ollama server" | tee -a /root/.ollama/logs/server.log
       return 1
   }

   # Wait for server
   if ! wait_for_server; then
       echo "Server failed to start. Logs:" | tee -a /root/.ollama/logs/server.log
       cat /root/.ollama/logs/server.log
       kill $SERVER_PID 2>/dev/null || true
       exit 1
   fi

   # Model handling
   echo "Checking model ${OLLAMA_MODEL}..." | tee -a /root/.ollama/logs/server.log
   if ! ollama list | grep -q "${OLLAMA_MODEL}"; then
       echo "Pulling model ${OLLAMA_MODEL}..." | tee -a /root/.ollama/logs/server.log
       ollama pull "${OLLAMA_MODEL}" || {
           echo "Failed to pull model. Trying with more memory..." | tee -a /root/.ollama/logs/server.log
           OLLAMA_KEEP_ALIVE=1 OLLAMA_MAX_LOADED_MODELS=1 ollama pull "${OLLAMA_MODEL}" || {
               echo "Critical: Failed to pull model after retry" | tee -a /root/.ollama/logs/server.log
               exit 1
           }
       }
   fi

   # Keep container running
   wait $SERVER_PID