#!/bin/bash
export MINIO_ROOT_USER=sai-dev
export MINIO_ROOT_PASSWORD=sai-dev-secret
exec /tmp/minio server /home/rizo/projects/sai/versions/sai_0_0_5/.minio-data --address ':9002' --console-address ':9003'
