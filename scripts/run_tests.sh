#!/bin/bash

# run_tests.sh - A script to safely run tests with shell readiness checks
# This script ensures that no previous test processes are running before starting new tests

# Function to check if any mocha processes are running
check_mocha_processes() {
  ps aux | grep -v grep | grep -c "mocha"
}

# Function to wait until all mocha processes are finished
wait_for_mocha_completion() {
  local timeout=30
  local count=0
  
  echo "Checking for running mocha processes..."
  
  while [ $(check_mocha_processes) -gt 0 ] && [ $count -lt $timeout ]; do
    echo "Waiting for mocha processes to complete... ($count/$timeout seconds)"
    sleep 1
    count=$((count + 1))
  done
  
  if [ $(check_mocha_processes) -gt 0 ]; then
    echo "WARNING: Mocha processes still running after $timeout seconds. Attempting to kill them..."
    pkill -f mocha
    sleep 2
  fi
  
  echo "Shell is ready for test execution."
}

# Main execution
wait_for_mocha_completion

echo "Running tests: $@"
npx mocha "$@"

exit_code=$?
echo "Tests completed with exit code: $exit_code"
exit $exit_code
