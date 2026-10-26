#!/bin/sh
set -eu
# Render mounts a new persistent disk as root. Only its ownership is initialized
# with privileges; the HTTP process and all uploads run as the unprivileged user.
mkdir -p /var/data/factory
chown node:node /var/data/factory
chmod 700 /var/data/factory
exec gosu node node apps/factory-render/service.mjs
