# Docker

Building docker images for production.

To build the production docker image run this in the root directory:

    docker build -f ./production.Dockerfile . -t trustrootsops/trustroots:latest

Then push the docker image like:

    docker push trustrootsops/trustroots:latest

To do this, you need the relevant permissions on docker hub.
