#!/bin/zsh

TOKEN=$1
DATA='{"data": {"uid": "user2", "gid": "group1" }}'
FUNCTION="http://127.0.0.1:5001/hhhq-e94fc/southamerica-east1/removeUser"

./test.sh $TOKEN $FUNCTION $DATA
