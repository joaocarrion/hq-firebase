#!/bin/zsh

if [[ $# -lt 3 ]]; then
  echo "Usage: ./test.sh TOKEN FUNCTION_NAME JSON_PARAMS"
  exit 1
fi

TOKEN=$1
FUNCTION=$2
PARAMS=$3

curl -k -X POST ${FUNCTION} \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d ${PARAMS}

